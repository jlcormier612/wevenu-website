/**
 * Phase D planning materials. One migration row, one existing planning record.
 * Does not apply a Setup Profile, release the client portal, invite, email,
 * charge, or change booking status.
 */
import type { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/documents/access";
import type { DocumentCategory } from "@/lib/documents/types";
import { insertCustomLine, insertEventOrder, insertSection } from "@/lib/event-orders/repository";
import { assertMigrationDocumentStorageExists } from "@/lib/migration/document-storage-guard";
import { commitEventVendorAssignmentQuietly } from "@/lib/migration/event-vendor-assignment";
import { HELD_PREFIX } from "@/lib/migration/financial-import";
import { resolveEventForMigration, resolveSpaceId } from "@/lib/migration/resolve-refs";
import { syncTimelineFromEventSpaceAssignments } from "@/lib/timeline/schedule-sync";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export const PLANNING_KINDS = [
  "task",
  "timeline",
  "questionnaire",
  "document",
  "floor_plan",
  "event_order",
  "vendor_assignment",
] as const;

export type PlanningKind = (typeof PLANNING_KINDS)[number];

export type PlanningCommitResult =
  | { ok: true; entityId: string; alreadyImported?: boolean }
  | { ok: false; error: string };

export type NormalizedPlanningRecord = {
  recordKind?: string | null;
  sourceId?: string | null;
  eventId?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  eventDate?: string | null;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  taskStatus?: string | null;
  ownership?: string | null;
  assigneeEmail?: string | null;
  timelineRole?: string | null;
  entryTime?: string | null;
  endTime?: string | null;
  occurredOn?: string | null;
  spaceName?: string | null;
  spaceId?: string | null;
  questions?: string | null;
  answers?: string | null;
  questionnaireStatus?: string | null;
  submittedAt?: string | null;
  fileName?: string | null;
  storagePath?: string | null;
  storageUrl?: string | null;
  mimeType?: string | null;
  category?: string | null;
  lineDescription?: string | null;
  quantity?: string | null;
  unitPrice?: string | null;
  included?: string | null;
  selected?: string | null;
  vendorName?: string | null;
  vendorId?: string | null;
  arrivalTime?: string | null;
};

const MARKER = (sourceId: string) => `[migration:${sourceId}]`;

export function isPlanningKind(value: string): value is PlanningKind {
  return (PLANNING_KINDS as readonly string[]).includes(value);
}

/** Completed means the source said so. A missing completion date stays unknown. */
export function planningTaskCompletion(input: {
  taskStatus?: string | null;
  completedAt?: string | null;
}): { status: "complete" | "pending"; completedAt: string | null } {
  const raw = (input.taskStatus ?? "").trim().toLowerCase();
  const completed = raw === "complete" || raw === "completed" || raw === "done";
  const completedAt = input.completedAt?.trim()?.slice(0, 10) || null;
  if (!completed) return { status: "pending", completedAt: null };
  return { status: "complete", completedAt };
}

/** Schedule rows stay on the schedule. Manual and client rows are not schedule-generated. */
export function planningTimelineRole(value: string | null | undefined): "manual" | "client" | "schedule" | null {
  const raw = (value ?? "").trim().toLowerCase() || "manual";
  if (raw === "manual" || raw === "venue") return "manual";
  if (raw === "client") return "client";
  if (raw === "schedule") return "schedule";
  return null;
}

function hold(message: string): { ok: false; error: string } {
  return { ok: false, error: message.startsWith(HELD_PREFIX) ? message : `${HELD_PREFIX} ${message}` };
}

function dayOffset(eventDate: string | null, occurredOn: string | null): number {
  if (!eventDate || !occurredOn) return 0;
  const start = eventDate.slice(0, 10);
  const day = occurredOn.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return 0;
  const diff = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(diff)) return 0;
  return Math.round(diff / 86_400_000);
}

async function resolveEvent(client: DbClient, venueId: string, record: NormalizedPlanningRecord) {
  const resolved = await resolveEventForMigration(client, venueId, record);
  if (resolved.ok) return resolved;
  if (resolved.error.startsWith("Multiple Events")) return hold(resolved.error);
  return { ok: false as const, error: resolved.error };
}

async function findMarker(
  client: DbClient,
  table: "event_tasks" | "timeline_entries" | "documents" | "event_space_assignments",
  venueId: string,
  eventId: string,
  sourceId: string,
  column: "description" | "notes" | "use_key",
): Promise<string | null> {
  const marker = column === "use_key" ? `migration:${sourceId}` : MARKER(sourceId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from(table) as any).select("id").eq("venue_id", venueId);
  if (table !== "documents") query = query.eq(table === "event_space_assignments" ? "event_id" : "event_id", eventId);
  else query = query.eq("event_id", eventId);
  if (column === "use_key") query = query.eq("use_key", marker);
  else query = query.ilike(column, `%${marker}%`);
  const { data } = await query.limit(1).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function commitPlanningRecord(
  client: DbClient,
  venueId: string,
  record: NormalizedPlanningRecord,
): Promise<PlanningCommitResult> {
  const sourceId = record.sourceId?.trim();
  if (!sourceId) return { ok: false, error: "A source id is required so a retry does not create a second copy." };
  const kind = record.recordKind?.trim() ?? "";
  if (!isPlanningKind(kind)) {
    return { ok: false, error: "Planning rows need a record kind of task, timeline, questionnaire, document, floor_plan, event_order, or vendor_assignment." };
  }
  if (kind === "floor_plan") {
    return commitPlanningDocument(client, venueId, {
      ...record,
      category: "floor_plan",
      notes: record.notes?.trim() || "Imported floor plan file. This is the original document, not an editable room layout.",
    }, sourceId, false);
  }
  if (kind === "vendor_assignment") {
    const result = await commitEventVendorAssignmentQuietly(client, venueId, {
      eventId: record.eventId,
      clientEmail: record.clientEmail,
      clientId: record.clientId,
      eventDate: record.eventDate,
      vendorId: record.vendorId,
      vendorBusinessName: record.vendorName,
      notes: record.notes,
      arrivalTime: record.arrivalTime,
      sourceId,
    }, { allowPastEvent: true });
    if (!result.ok) {
      return result.error.startsWith("Multiple Events") ? hold(result.error) : result;
    }
    return { ok: true, entityId: result.assignmentId, alreadyImported: result.alreadyExisted };
  }
  if (kind === "document") return commitPlanningDocument(client, venueId, record, sourceId, false);
  if (kind === "questionnaire") return commitQuestionnaire(client, venueId, record, sourceId);

  const event = await resolveEvent(client, venueId, record);
  if (!event.ok) return event;

  if (kind === "task") return commitTask(client, venueId, event.eventId, record, sourceId);
  if (kind === "timeline") return commitTimeline(client, venueId, event, record, sourceId);
  return commitEventOrder(client, venueId, event.eventId, record, sourceId);
}

async function commitTask(
  client: DbClient,
  venueId: string,
  eventId: string,
  record: NormalizedPlanningRecord,
  sourceId: string,
): Promise<PlanningCommitResult> {
  const title = record.title?.trim();
  if (!title) return { ok: false, error: "A planning task needs a title." };
  const dueDate = record.dueDate?.trim()?.slice(0, 10) || null;
  if (!dueDate) return { ok: false, error: "A planning task needs its original due date. Today's date was not used." };
  const existing = await findMarker(client, "event_tasks", venueId, eventId, sourceId, "description");
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: titled } = await (client.from("event_tasks") as any)
    .select("id, description")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .ilike("title", title);
  const clash = ((titled ?? []) as { id: string; description: string | null }[])
    .find((row) => !(row.description ?? "").includes("[migration:"));
  if (clash) {
    return hold(`A task named "${title}" is already on this event. Review it before importing another.`);
  }

  const completion = planningTaskCompletion(record);
  const clientOwned = (record.ownership ?? "").trim().toLowerCase() === "client";
  let assignee: string | null = null;
  const email = record.assigneeEmail?.trim();
  let assignmentNote = "";
  if (email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staff } = await (client.from("venue_staff") as any)
      .select("id")
      .eq("venue_id", venueId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (staff?.id) assignee = staff.id as string;
    else assignmentNote = "Assignment was not matched to a staff member and was left unassigned.";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("event_tasks") as any).insert({
    venue_id: venueId,
    event_id: eventId,
    template_task_id: null,
    title,
    description: [record.description?.trim() || "", MARKER(sourceId), assignmentNote].filter(Boolean).join("\n"),
    owner_type: clientOwned ? "couple" : "coordinator",
    visibility: clientOwned ? "client_owned" : "coordinator_only",
    due_date: dueDate,
    days_offset: 0,
    due_date_locked: true,
    due_date_rule_kind: "relative_to_event",
    category: "custom",
    milestone_name: "Planning",
    is_required: false,
    status: completion.status,
    completed_at: completion.completedAt,
    notes: record.notes?.trim() || null,
    sort_order: 0,
    notify_on_assign: false,
    notify_on_complete: false,
    reminder_before_days: null,
    assigned_to_staff_id: assignee,
  }).select("id").single();
  if (error) throw error;
  return { ok: true, entityId: (data as { id: string }).id };
}

async function commitTimeline(
  client: DbClient,
  venueId: string,
  event: { eventId: string; clientId: string; eventDate: string | null },
  record: NormalizedPlanningRecord,
  sourceId: string,
): Promise<PlanningCommitResult> {
  const title = record.title?.trim();
  if (!title) return { ok: false, error: "A timeline entry needs a title." };
  const role = planningTimelineRole(record.timelineRole);
  if (!role) return { ok: false, error: "Timeline role must be manual, client, or schedule." };
  if (role === "schedule") return commitScheduleEntry(client, venueId, event, record, sourceId, title);

  const existing = await findMarker(client, "timeline_entries", venueId, event.eventId, sourceId, "notes");
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };
  const occurred = record.occurredOn?.trim()?.slice(0, 10) || event.eventDate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("timeline_entries") as any).insert({
    venue_id: venueId,
    event_id: event.eventId,
    client_id: role === "client" ? event.clientId : null,
    title,
    description: record.description?.trim() || null,
    notes: [record.notes?.trim() || "", MARKER(sourceId), "Imported planning entry. Not generated from the schedule."].filter(Boolean).join("\n"),
    entry_time: record.entryTime?.trim()?.slice(0, 5) || null,
    end_time: record.endTime?.trim()?.slice(0, 5) || null,
    day_offset: dayOffset(event.eventDate, occurred),
    audiences: [],
    sort_order: 0,
    owner: role === "client" ? "client" : "venue",
    lock_state: "locked",
    status: "not_started",
    source_space_use_key: null,
  }).select("id").single();
  if (error) throw error;
  return { ok: true, entityId: (data as { id: string }).id };
}

async function commitScheduleEntry(
  client: DbClient,
  venueId: string,
  event: { eventId: string; eventDate: string | null },
  record: NormalizedPlanningRecord,
  sourceId: string,
  title: string,
): Promise<PlanningCommitResult> {
  const start = record.entryTime?.trim()?.slice(0, 5);
  const scheduled = record.occurredOn?.trim()?.slice(0, 10) || event.eventDate;
  if (!start || !scheduled) {
    return hold("A schedule entry needs its original start time and date. It was not copied onto the timeline.");
  }
  const space = await resolveSpaceId(client, venueId, record.spaceId, record.spaceName);
  if (!space.ok) return space;
  if (!space.spaceId) return hold("A schedule entry needs a space. It was not copied onto the timeline.");
  const useKey = `migration:${sourceId}`;
  const existing = await findMarker(client, "event_space_assignments", venueId, event.eventId, sourceId, "use_key");
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("event_space_assignments") as any).insert({
    venue_id: venueId,
    event_id: event.eventId,
    space_id: space.spaceId,
    use_key: useKey,
    use_label: title,
    start_time: start,
    end_time: record.endTime?.trim()?.slice(0, 5) || null,
    scheduled_date: scheduled,
    sort_order: 0,
  }).select("id").single();
  if (error) throw error;
  await syncTimelineFromEventSpaceAssignments(client, venueId, event.eventId);
  return { ok: true, entityId: (data as { id: string }).id };
}

async function commitQuestionnaire(
  client: DbClient,
  venueId: string,
  record: NormalizedPlanningRecord,
  sourceId: string,
): Promise<PlanningCommitResult> {
  const title = record.title?.trim();
  if (!title) return { ok: false, error: "A questionnaire needs a title." };
  const status = (record.questionnaireStatus ?? "draft").trim().toLowerCase();
  const answers = record.answers?.trim() || "";
  if ((status === "submitted" || status === "complete") && !answers) {
    return { ok: false, error: "A submitted questionnaire needs its answers. It was not marked completed." };
  }
  const event = await resolveEvent(client, venueId, record);
  if (!event.ok) return event;
  const existing = await findMarker(client, "documents", venueId, event.eventId, sourceId, "notes");
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };

  const submitted = record.submittedAt?.trim()?.slice(0, 10) || null;
  const body = [
    `Questionnaire: ${title}`,
    `Status: ${answers ? (status === "draft" ? "draft" : "submitted") : "not completed"}`,
    submitted ? `Submitted: ${submitted}` : "Submission date: unknown",
    "",
    record.questions?.trim() ? `Questions:\n${record.questions.trim()}` : "",
    answers ? `Answers:\n${answers}` : "No answers were in the file.",
  ].filter(Boolean).join("\n");
  const path = `${venueId}/planning-import/${sourceId}.txt`;
  const admin = createAdminClient();
  const uploaded = await admin.storage.from(DOCUMENTS_BUCKET).upload(path, body, {
    contentType: "text/plain",
    upsert: true,
  });
  if (uploaded.error) return { ok: false, error: "The questionnaire file could not be stored." };
  return insertPrivateDocument(client, venueId, {
    eventId: event.eventId,
    name: title,
    fileName: `${sourceId}.txt`,
    storagePath: path,
    mimeType: "text/plain",
    fileSize: body.length,
    category: "questionnaire",
    notes: [
      "Imported questionnaire. Not sent from Hello to Cheers.",
      answers ? "" : "Not completed.",
      submitted ? `Submitted ${submitted}.` : "Submission date was not in the file.",
      MARKER(sourceId),
    ].filter(Boolean).join(" "),
  });
}

async function commitPlanningDocument(
  client: DbClient,
  venueId: string,
  record: NormalizedPlanningRecord,
  sourceId: string,
  questionnaire: boolean,
): Promise<PlanningCommitResult> {
  const storagePath = record.storagePath?.trim();
  const fileName = record.fileName?.trim();
  if (!storagePath || !fileName) return { ok: false, error: "Documents need a file name and storage path from an uploaded file." };
  const stored = await assertMigrationDocumentStorageExists(storagePath);
  if (!stored.ok) return stored;
  const event = await resolveEvent(client, venueId, record);
  if (!event.ok) return event;
  const existing = await findMarker(client, "documents", venueId, event.eventId, sourceId, "notes");
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };
  return insertPrivateDocument(client, venueId, {
    eventId: event.eventId,
    name: record.title?.trim() || fileName,
    fileName,
    storagePath,
    storageUrl: record.storageUrl?.trim() || null,
    mimeType: record.mimeType?.trim() || "application/pdf",
    fileSize: 0,
    category: questionnaire ? "questionnaire" : documentCategory(record.category),
    notes: [record.notes?.trim() || "Imported planning document. Not shared with the client.", MARKER(sourceId)].join("\n"),
  });
}

async function insertPrivateDocument(
  client: DbClient,
  venueId: string,
  input: {
    eventId: string;
    name: string;
    fileName: string;
    storagePath: string;
    storageUrl?: string | null;
    mimeType: string;
    fileSize: number;
    category: string;
    notes: string;
  },
): Promise<PlanningCommitResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("documents") as any).insert({
    venue_id: venueId,
    event_id: input.eventId,
    name: input.name,
    file_name: input.fileName,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    storage_path: input.storagePath,
    storage_url: input.storageUrl || "",
    category: input.category,
    notes: input.notes,
    tags: ["migration", "planning"],
    is_couple_visible: false,
    shared_with_vendors: false,
  }).select("id").single();
  if (error) throw error;
  return { ok: true, entityId: (data as { id: string }).id };
}

const DOCUMENT_CATEGORIES = new Set<string>([
  "contract", "insurance", "inspiration", "floor_plan", "menu", "permit", "questionnaire", "invoice_copy", "other",
]);

function documentCategory(value: string | null | undefined): DocumentCategory {
  const raw = value?.trim() || "other";
  return (DOCUMENT_CATEGORIES.has(raw) ? raw : "other") as DocumentCategory;
}

async function commitEventOrder(
  client: DbClient,
  venueId: string,
  eventId: string,
  record: NormalizedPlanningRecord,
  sourceId: string,
): Promise<PlanningCommitResult> {
  const description = record.lineDescription?.trim();
  const selected = (record.selected ?? "").trim().toLowerCase();
  if (!description || selected === "catalog" || selected === "no" || selected === "false") {
    if (!description && record.fileName && record.storagePath) {
      return commitPlanningDocument(client, venueId, { ...record, category: "other", notes: "Imported event order document. Not an interactive selection." }, sourceId, false);
    }
    return hold("An offerings catalog is not a confirmed order. Say selected=yes for a real selection, or attach the historical order as a document.");
  }
  if (selected !== "yes" && selected !== "true") {
    return hold("An offerings catalog is not a confirmed order. Say selected=yes for a real selection, or attach the historical order as a document.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (client.from("event_orders") as any)
    .select("id, shared_at, status")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (order?.shared_at || order?.status === "finalized") {
    return hold("This event order was already shared or finalized. Import will not change it.");
  }

  const marker = MARKER(sourceId);
  if (order?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lines } = await (client.from("event_order_lines") as any)
      .select("id, description, notes")
      .eq("venue_id", venueId)
      .eq("event_order_id", order.id);
    const rows = (lines ?? []) as { id: string; description: string | null; notes: string | null }[];
    const already = rows.find((row) => (row.notes ?? "").includes(marker));
    if (already) return { ok: true, entityId: already.id, alreadyImported: true };
    const clash = rows.find((row) => (row.description ?? "").trim().toLowerCase() === description.toLowerCase() && !(row.notes ?? "").includes("[migration:"));
    if (clash) return hold(`A selection named "${description}" is already on this event order. Review it before importing another.`);
  }

  const orderId = (order?.id as string | undefined) ?? await insertEventOrder(client, venueId, eventId, null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingSection } = await (client.from("event_order_sections") as any)
    .select("id")
    .eq("event_order_id", orderId)
    .eq("venue_id", venueId)
    .eq("name", "Imported selections")
    .maybeSingle();
  const sectionId = (existingSection?.id as string | undefined)
    ?? (await insertSection(client, venueId, orderId, "Imported selections", 0)).id;
  const quantity = record.quantity?.trim() || "1";
  const included = (record.included ?? "yes").trim().toLowerCase() !== "no";
  const line = await insertCustomLine(client, venueId, orderId, {
    description,
    quantity,
    unitPrice: record.unitPrice?.trim() || "",
    sectionId,
    isIncluded: included,
    notes: [record.notes?.trim() || "Imported selection. Not released to the client.", marker].join("\n"),
  }, 0);
  return { ok: true, entityId: line.id };
}

import { createClient } from "@/integrations/supabase/server";
import type {
  EventPlaybookApplication,
  EventReadiness,
  EventTask,
  EventTaskContextLink,
  EventTaskContextSourceType,
  PlaybookMilestone,
  PlaybookTask,
  PlaybookTaskAttachment,
  PlaybookTemplate,
  PlaybookTemplateWithStats,
  TaskReminderRole,
  TaskStatus,
} from "@/lib/playbooks/types";

// Default reminder schedule when playbook_task has no reminderBeforeDays set.
// Venues can customize this per-task in a future sprint.
const DEFAULT_REMINDER_BEFORE_DAYS = [7, 3, 1];

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = { id: string; venue_id: string; name: string; kind: string; event_type: string | null; is_default: boolean; is_archived: boolean; description: string | null; created_at: string; updated_at: string; };
type MilestoneRow = { id: string; template_id: string; venue_id: string; name: string; kind: string | null; sort_order: number; created_at: string; updated_at: string; };
type TaskRow = { id: string; template_id: string; venue_id: string; title: string; description: string | null; owner_type: string; visibility: string; days_offset: number; due_date_rule_kind: string; category: string; milestone_id: string; auto_complete_trigger: string | null; depends_on_task_id: string | null; is_required: boolean; sort_order: number; created_at: string; reminder_before_days: number[] | null; escalation_after_days: number | null; notify_on_assign: boolean; notify_on_complete: boolean; action_type: string | null; action_label: string | null; };
type EventTaskRow = { id: string; venue_id: string; event_id: string; template_task_id: string | null; title: string; description: string | null; owner_type: string; visibility: string; due_date: string; days_offset: number; due_date_rule_kind: string; due_date_locked: boolean; category: string; milestone_name: string; milestone_kind: string | null; auto_complete_trigger: string | null; is_required: boolean; status: string; depends_on_event_task_id: string | null; depends_on_title?: string | null; completed_at: string | null; completed_by: string | null; notes: string | null; sort_order: number; created_at: string; updated_at: string; reminder_before_days: number[] | null; escalation_after_days: number | null; notify_on_assign: boolean; notify_on_complete: boolean; assigned_to_staff_id: string | null; assigned_to_name?: string | null; action_type: string | null; action_label: string | null; request_id: string | null; scheduled_date: string | null; scheduled_start_time: string | null; scheduled_end_time: string | null; location: string | null; };

const mapTemplate = (r: TemplateRow): PlaybookTemplate => ({ id: r.id, venueId: r.venue_id, name: r.name, kind: r.kind as PlaybookTemplate["kind"], eventType: r.event_type, isDefault: r.is_default, isArchived: r.is_archived, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at });
const mapMilestone = (r: MilestoneRow): PlaybookMilestone => ({ id: r.id, templateId: r.template_id, venueId: r.venue_id, name: r.name, kind: (r.kind as PlaybookMilestone["kind"]) ?? null, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });
const mapTask = (r: TaskRow): PlaybookTask => ({ id: r.id, templateId: r.template_id, venueId: r.venue_id, title: r.title, description: r.description, ownerType: r.owner_type as PlaybookTask["ownerType"], visibility: r.visibility as PlaybookTask["visibility"], daysOffset: r.days_offset, dueDateRuleKind: r.due_date_rule_kind as PlaybookTask["dueDateRuleKind"], category: r.category as PlaybookTask["category"], milestoneId: r.milestone_id, autoCompleteTrigger: r.auto_complete_trigger, dependsOnTaskId: r.depends_on_task_id, isRequired: r.is_required, sortOrder: r.sort_order, createdAt: r.created_at, reminderBeforeDays: r.reminder_before_days ?? null, escalationAfterDays: r.escalation_after_days ?? null, notifyOnAssign: r.notify_on_assign, notifyOnComplete: r.notify_on_complete, actionType: (r.action_type as PlaybookTask["actionType"]) ?? null, actionLabel: r.action_label ?? null });
const mapEventTask = (r: EventTaskRow): EventTask => ({ id: r.id, venueId: r.venue_id, eventId: r.event_id, templateTaskId: r.template_task_id, title: r.title, description: r.description, ownerType: r.owner_type as EventTask["ownerType"], visibility: r.visibility as EventTask["visibility"], dueDate: r.due_date, daysOffset: r.days_offset, dueDateRuleKind: r.due_date_rule_kind as EventTask["dueDateRuleKind"], dueDateLocked: r.due_date_locked, category: r.category as EventTask["category"], milestoneName: r.milestone_name, milestoneKind: (r.milestone_kind as EventTask["milestoneKind"]) ?? null, autoCompleteTrigger: r.auto_complete_trigger, isRequired: r.is_required, status: computeStatus(r), dependsOnEventTaskId: r.depends_on_event_task_id, dependsOnTitle: r.depends_on_title ?? null, completedAt: r.completed_at, completedBy: r.completed_by, notes: r.notes, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at, reminderBeforeDays: r.reminder_before_days ?? null, escalationAfterDays: r.escalation_after_days ?? null, notifyOnAssign: r.notify_on_assign, notifyOnComplete: r.notify_on_complete, assignedToStaffId: r.assigned_to_staff_id ?? null, assignedToName: r.assigned_to_name ?? null, actionType: (r.action_type as EventTask["actionType"]) ?? null, actionLabel: r.action_label ?? null, requestId: r.request_id ?? null, scheduledDate: r.scheduled_date ?? null, scheduledStartTime: r.scheduled_start_time ?? null, scheduledEndTime: r.scheduled_end_time ?? null, location: r.location ?? null });

function computeStatus(r: EventTaskRow): TaskStatus {
  if (r.status === "complete" || r.status === "waived") return r.status as TaskStatus;
  if (r.status === "blocked") return "blocked";
  if (new Date(r.due_date) < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00")) return "overdue";
  return "pending";
}

// ---- Templates ---------------------------------------------------------------

// Archived templates are excluded by default — every existing caller (the
// booking-apply flows in particular) gets Requirement 7's behavior for
// free, with no call-site changes needed. Only the Library page opts into
// includeArchived: true.
export async function getTemplates(client: DbClient, venueId: string, opts?: { includeArchived?: boolean }): Promise<PlaybookTemplate[]> {
  let query = client.from("playbook_templates").select("*").eq("venue_id", venueId);
  if (!opts?.includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function getTemplate(client: DbClient, venueId: string, id: string): Promise<PlaybookTemplate | null> {
  const { data } = await client.from("playbook_templates").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>();
  return data ? mapTemplate(data) : null;
}

// Library card grid needs task/usage counts alongside every template,
// archived included. Counts are computed in JS from flat row fetches
// rather than a PostgREST embedded-count select — this codebase has hit
// real bugs from untested embedded-relationship syntax before.
export async function getTemplatesWithStats(client: DbClient, venueId: string): Promise<PlaybookTemplateWithStats[]> {
  const [{ data: templateRows, error: templateError }, { data: taskRows, error: taskError }, { data: applicationRows, error: applicationError }, { data: milestoneRows, error: milestoneError }] = await Promise.all([
    client.from("playbook_templates").select("*").eq("venue_id", venueId).order("name"),
    client.from("playbook_tasks").select("template_id").eq("venue_id", venueId),
    client.from("event_playbook_applications").select("template_id").eq("venue_id", venueId),
    client.from("playbook_milestones").select("template_id").eq("venue_id", venueId),
  ]);
  if (templateError) throw templateError;
  if (taskError) throw taskError;
  if (applicationError) throw applicationError;
  if (milestoneError) throw milestoneError;

  const taskCounts = new Map<string, number>();
  for (const row of taskRows as { template_id: string }[]) taskCounts.set(row.template_id, (taskCounts.get(row.template_id) ?? 0) + 1);

  const usageCounts = new Map<string, number>();
  for (const row of applicationRows as { template_id: string | null }[]) {
    if (!row.template_id) continue;
    usageCounts.set(row.template_id, (usageCounts.get(row.template_id) ?? 0) + 1);
  }

  const milestoneCounts = new Map<string, number>();
  for (const row of milestoneRows as { template_id: string }[]) milestoneCounts.set(row.template_id, (milestoneCounts.get(row.template_id) ?? 0) + 1);

  return (templateRows as TemplateRow[]).map((r) => ({
    ...mapTemplate(r),
    taskCount: taskCounts.get(r.id) ?? 0,
    usageCount: usageCounts.get(r.id) ?? 0,
    milestoneCount: milestoneCounts.get(r.id) ?? 0,
  }));
}

export async function insertTemplate(client: DbClient, venueId: string, name: string, kind: PlaybookTemplate["kind"], eventType: string | null, description: string | null): Promise<string> {
  const { data, error } = await client.from("playbook_templates").insert({ venue_id: venueId, name: name.trim(), kind, event_type: eventType || null, description: description?.trim() || null }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function renameTemplate(client: DbClient, venueId: string, id: string, name: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("playbook_templates") as any).update({ name: name.trim() }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

// Clear-then-set within the same (venue, event_type, kind) group so the
// unique partial index (playbook_templates_default) is never asked to hold
// two defaults at once.
export async function setTemplateDefault(client: DbClient, venueId: string, id: string, eventType: string | null, kind: PlaybookTemplate["kind"]): Promise<void> {
  let clearQuery = client.from("playbook_templates").update({ is_default: false } as never).eq("venue_id", venueId).eq("kind", kind).neq("id", id);
  clearQuery = eventType ? clearQuery.eq("event_type", eventType) : clearQuery.is("event_type", null);
  const { error: clearError } = await clearQuery;
  if (clearError) throw clearError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("playbook_templates") as any).update({ is_default: true }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setTemplateArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // Archiving a template can't leave it as the default — that would make
  // it disappear from booking-apply flows while still being auto-selected.
  const patch: Record<string, unknown> = { is_archived: isArchived };
  if (isArchived) patch.is_default = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("playbook_templates") as any).update(patch).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<void> {
  const { error } = await client.from("playbook_templates").delete().eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

/** Clone a template's milestones and tasks into a brand-new template — same kind as the source. */
export async function duplicateTemplateInto(
  client: DbClient, venueId: string, sourceTemplateId: string,
  newName: string, kind: PlaybookTemplate["kind"], eventType: string | null, description: string | null,
): Promise<string> {
  const newTemplateId = await insertTemplate(client, venueId, newName, kind, eventType, description);

  const [milestones, tasks] = await Promise.all([
    getMilestones(client, venueId, sourceTemplateId),
    getTemplateTasks(client, venueId, sourceTemplateId),
  ]);

  const milestoneIdMap = new Map<string, string>();
  for (const m of milestones) {
    const newId = await insertMilestone(client, venueId, newTemplateId, m.name, m.sortOrder, m.kind ?? undefined);
    milestoneIdMap.set(m.id, newId);
  }

  // Two passes, same shape as applyPlaybookToEvent's idMap: insert every task
  // first (dependencies temporarily dropped), then backfill dependsOnTaskId
  // once every old-task-id -> new-task-id mapping is known.
  const taskIdMap = new Map<string, string>();
  for (const t of tasks) {
    const newMilestoneId = milestoneIdMap.get(t.milestoneId);
    if (!newMilestoneId) continue; // shouldn't happen; skip defensively rather than insert an orphaned task
    const { data: inserted, error } = await client.from("playbook_tasks").insert({
      template_id: newTemplateId, venue_id: venueId, title: t.title,
      description: t.description, owner_type: t.ownerType, visibility: t.visibility,
      days_offset: t.daysOffset, due_date_rule_kind: t.dueDateRuleKind, category: t.category, milestone_id: newMilestoneId,
      auto_complete_trigger: t.autoCompleteTrigger, depends_on_task_id: null,
      is_required: t.isRequired, sort_order: t.sortOrder,
      reminder_before_days: t.reminderBeforeDays, escalation_after_days: t.escalationAfterDays,
      notify_on_assign: t.notifyOnAssign, notify_on_complete: t.notifyOnComplete,
      action_type: t.actionType, action_label: t.actionLabel,
    }).select("id").single<{ id: string }>();
    if (error) throw error;
    taskIdMap.set(t.id, inserted.id);
    await copyTaskAttachments(client, venueId, t.id, inserted.id);
  }

  for (const t of tasks) {
    if (!t.dependsOnTaskId) continue;
    const newTaskId = taskIdMap.get(t.id);
    const newDependsOnId = taskIdMap.get(t.dependsOnTaskId);
    if (!newTaskId || !newDependsOnId) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("playbook_tasks") as any).update({ depends_on_task_id: newDependsOnId }).eq("id", newTaskId).eq("venue_id", venueId);
  }

  return newTemplateId;
}

// ---- Milestones ---------------------------------------------------------------

export async function getMilestones(client: DbClient, venueId: string, templateId: string): Promise<PlaybookMilestone[]> {
  const { data, error } = await client.from("playbook_milestones").select("*").eq("template_id", templateId).eq("venue_id", venueId).order("sort_order");
  if (error) throw error;
  return (data as MilestoneRow[]).map(mapMilestone);
}

export async function insertMilestone(client: DbClient, venueId: string, templateId: string, name: string, sortOrder: number, kind?: PlaybookMilestone["kind"]): Promise<string> {
  const { data, error } = await client.from("playbook_milestones")
    .insert({ template_id: templateId, venue_id: venueId, name: name.trim(), sort_order: sortOrder, kind: kind ?? null })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function renameMilestone(client: DbClient, venueId: string, milestoneId: string, name: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("playbook_milestones") as any).update({ name: name.trim() }).eq("id", milestoneId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Marks (or unmarks) a milestone as the template's Wedding Day chapter —
 * every task in it inherits milestone_kind='event_day' at apply time and
 * is what get_wedding_day_ops surfaces (Planning Execution — Release
 * Completion). Before this, `kind` could only ever be set by seed/migration
 * code — a coordinator building their own template had no way to mark
 * anything as Wedding Day at all. `playbook_milestones_one_event_day` (a
 * partial unique index) allows at most one per template, so setting a new
 * one clears any other milestone in this template that already had it —
 * "moving" the designation, not stacking a second one.
 */
export async function setMilestoneKind(
  client: DbClient, venueId: string, templateId: string, milestoneId: string, kind: PlaybookMilestone["kind"],
): Promise<void> {
  if (kind !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: clearError } = await (client.from("playbook_milestones") as any)
      .update({ kind: null }).eq("template_id", templateId).eq("venue_id", venueId).eq("kind", kind).neq("id", milestoneId);
    if (clearError) throw clearError;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("playbook_milestones") as any).update({ kind }).eq("id", milestoneId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function reorderMilestone(client: DbClient, venueId: string, templateId: string, milestoneId: string, direction: "up" | "down"): Promise<void> {
  const milestones = await getMilestones(client, venueId, templateId);
  const idx = milestones.findIndex((m) => m.id === milestoneId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= milestones.length) return;
  const a = milestones[idx];
  const b = milestones[swapIdx];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = client.from("playbook_milestones") as any;
  await table.update({ sort_order: b.sortOrder }).eq("id", a.id).eq("venue_id", venueId);
  await table.update({ sort_order: a.sortOrder }).eq("id", b.id).eq("venue_id", venueId);
}

export async function deleteMilestone(client: DbClient, venueId: string, milestoneId: string): Promise<void> {
  const { error } = await client.from("playbook_milestones").delete().eq("id", milestoneId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Template Tasks ----------------------------------------------------------

export async function getTemplateTasks(client: DbClient, venueId: string, templateId: string): Promise<PlaybookTask[]> {
  const { data, error } = await client.from("playbook_tasks").select("*").eq("template_id", templateId).eq("venue_id", venueId).order("sort_order").order("days_offset");
  if (error) throw error;
  return (data as TaskRow[]).map(mapTask);
}

export async function insertTemplateTask(client: DbClient, venueId: string, templateId: string, task: Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">): Promise<string> {
  const { data, error } = await client.from("playbook_tasks").insert({
    template_id: templateId, venue_id: venueId, title: task.title.trim(),
    description: task.description?.trim() || null, owner_type: task.ownerType,
    visibility: task.visibility, days_offset: task.daysOffset, due_date_rule_kind: task.dueDateRuleKind, category: task.category,
    milestone_id: task.milestoneId,
    auto_complete_trigger: task.autoCompleteTrigger || null,
    depends_on_task_id: task.dependsOnTaskId || null,
    is_required: task.isRequired, sort_order: task.sortOrder,
    reminder_before_days: task.reminderBeforeDays, escalation_after_days: task.escalationAfterDays,
    notify_on_assign: task.notifyOnAssign, notify_on_complete: task.notifyOnComplete,
    action_type: task.actionType || null, action_label: task.actionLabel?.trim() || null,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateTemplateTask(client: DbClient, venueId: string, taskId: string, task: Partial<Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (task.title !== undefined) patch.title = task.title.trim();
  if (task.description !== undefined) patch.description = task.description?.trim() || null;
  if (task.ownerType !== undefined) patch.owner_type = task.ownerType;
  if (task.visibility !== undefined) patch.visibility = task.visibility;
  if (task.daysOffset !== undefined) patch.days_offset = task.daysOffset;
  if (task.category !== undefined) patch.category = task.category;
  if (task.milestoneId !== undefined) patch.milestone_id = task.milestoneId;
  if (task.autoCompleteTrigger !== undefined) patch.auto_complete_trigger = task.autoCompleteTrigger || null;
  if (task.dependsOnTaskId !== undefined) patch.depends_on_task_id = task.dependsOnTaskId || null;
  if (task.isRequired !== undefined) patch.is_required = task.isRequired;
  if (task.reminderBeforeDays !== undefined) patch.reminder_before_days = task.reminderBeforeDays;
  if (task.escalationAfterDays !== undefined) patch.escalation_after_days = task.escalationAfterDays;
  if (task.notifyOnAssign !== undefined) patch.notify_on_assign = task.notifyOnAssign;
  if (task.notifyOnComplete !== undefined) patch.notify_on_complete = task.notifyOnComplete;
  if (task.actionType !== undefined) patch.action_type = task.actionType || null;
  if (task.actionLabel !== undefined) patch.action_label = task.actionLabel?.trim() || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("playbook_tasks") as any).update(patch).eq("id", taskId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteTemplateTask(client: DbClient, venueId: string, taskId: string): Promise<void> {
  const { error } = await client.from("playbook_tasks").delete().eq("id", taskId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Event Tasks -------------------------------------------------------------

export async function getEventTasks(client: DbClient, venueId: string, eventId: string): Promise<EventTask[]> {
  const { data, error } = await client.from("event_tasks")
    .select("*, dep:depends_on_event_task_id(title), assignee:assigned_to_staff_id(full_name)")
    .eq("venue_id", venueId).eq("event_id", eventId)
    .order("sort_order").order("due_date");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => mapEventTask({ ...r, depends_on_title: r.dep?.title ?? null, assigned_to_name: r.assignee?.full_name ?? null }));
}

export async function getEventPlaybookApplications(client: DbClient, venueId: string, eventId: string): Promise<EventPlaybookApplication[]> {
  const { data, error } = await client.from("event_playbook_applications")
    .select("event_id, kind, template_id, template_name, applied_at, released_at")
    .eq("venue_id", venueId).eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    eventId: r.event_id, kind: r.kind as EventPlaybookApplication["kind"],
    templateId: r.template_id, templateName: r.template_name, appliedAt: r.applied_at,
    releasedAt: r.released_at ?? null,
  }));
}

export type ApplyPlaybookResult = { ok: true } | { ok: false; reason: "already_applied" };

export async function applyPlaybookToEvent(
  client: DbClient,
  venueId: string,
  eventId: string,
  templateId: string,
  eventDate: string,
): Promise<ApplyPlaybookResult> {
  const template = await getTemplate(client, venueId, templateId);
  if (!template) throw new Error("Template not found.");

  // Atomic, race-safe guard: this insert is the one and only place a playbook
  // gets marked as applied to this event, and the primary key on (event_id,
  // kind) means a concurrent second attempt at the *same* kind fails here
  // rather than after already inserting duplicate tasks — while still
  // allowing one Client Planning and one Venue Workflow application to
  // coexist on the same event (Product Decisions, 2026-07-08). No
  // replace/merge in V1 (docs/planning-playbook-evolution.md,
  // docs/product-backlog.md).
  // Venue Planning has no draft state — it's active the instant it's
  // applied, so released_at is set to applied_at (i.e. now) right here.
  // Client Planning starts in Draft (released_at null) until a coordinator
  // explicitly releases it (Draft → Release workflow, 2026-07-10).
  const { error: markerError } = await client.from("event_playbook_applications").insert({
    event_id: eventId, venue_id: venueId, template_id: templateId, kind: template.kind,
    template_name: template.name,
    released_at: template.kind === "venue" ? new Date().toISOString() : null,
  });
  if (markerError) {
    if (markerError.code === "23505") return { ok: false, reason: "already_applied" };
    throw markerError;
  }

  const [tasks, milestones] = await Promise.all([
    getTemplateTasks(client, venueId, templateId),
    getMilestones(client, venueId, templateId),
  ]);
  if (!tasks.length) return { ok: true };

  const milestoneById = new Map(milestones.map((m) => [m.id, m]));
  const idMap = new Map<string, string>();

  for (const t of tasks.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const dueDate = offsetDate(eventDate, t.daysOffset);
    const dependsOnEventTaskId = t.dependsOnTaskId ? idMap.get(t.dependsOnTaskId) ?? null : null;
    const milestone = milestoneById.get(t.milestoneId);

    const { data: inserted, error } = await client.from("event_tasks")
      .insert({
        venue_id: venueId, event_id: eventId, template_task_id: t.id,
        title: t.title, description: t.description, owner_type: t.ownerType,
        visibility: t.visibility, due_date: dueDate, days_offset: t.daysOffset,
        due_date_rule_kind: t.dueDateRuleKind,
        category: t.category,
        // Snapshot the milestone's name/kind at apply-time — a copy, not a live
        // reference, so editing the playbook later never silently alters an
        // event already in progress (matches how every other task field here
        // is already copied rather than referenced).
        milestone_name: milestone?.name ?? "Planning",
        milestone_kind: milestone?.kind ?? null,
        auto_complete_trigger: t.autoCompleteTrigger,
        depends_on_event_task_id: dependsOnEventTaskId,
        is_required: t.isRequired, sort_order: t.sortOrder,
        status: dependsOnEventTaskId !== null ? "blocked" : "pending",
        // Propagate notification rules from template
        reminder_before_days: t.reminderBeforeDays,
        escalation_after_days: t.escalationAfterDays,
        notify_on_assign: t.notifyOnAssign,
        notify_on_complete: t.notifyOnComplete,
        action_type: t.actionType,
        action_label: t.actionLabel,
      })
      .select("id").single<{ id: string }>();
    if (error) throw error;

    idMap.set(t.id, inserted.id);
    await copyAttachmentsToContextLinks(client, venueId, t.id, inserted.id);

    // Generate reminder records immediately — pending until Sprint 44 delivery
    // engine. Client Planning is the one exception: a couple should never get
    // a reminder for a checklist they can't see yet, so its reminders are
    // deferred to release time instead (releasePlaybookApplication, below).
    if (template.kind !== "client") {
      await createRemindersForTask(client, venueId, inserted.id, dueDate, t);
    }
  }

  return { ok: true };
}

export type ReleasePlaybookResult = { ok: true } | { ok: false; reason: "not_found" | "already_released" };

/** The deliberate second step for Client Planning: makes an already-applied
 *  checklist visible to the couple and generates its reminders, which were
 *  deliberately withheld at apply-time (Draft → Release workflow, 2026-07-10).
 *  Venue Planning never calls this — it has no draft state to release from. */
export async function releasePlaybookApplication(client: DbClient, venueId: string, eventId: string): Promise<ReleasePlaybookResult> {
  const { data: appRow, error: fetchError } = await client.from("event_playbook_applications")
    .select("released_at").eq("event_id", eventId).eq("venue_id", venueId).eq("kind", "client")
    .maybeSingle<{ released_at: string | null }>();
  if (fetchError) throw fetchError;
  if (!appRow) return { ok: false, reason: "not_found" };
  if (appRow.released_at) return { ok: false, reason: "already_released" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_playbook_applications") as any)
    .update({ released_at: new Date().toISOString() })
    .eq("event_id", eventId).eq("venue_id", venueId).eq("kind", "client");
  if (error) throw error;

  const tasks = await getEventTasks(client, venueId, eventId);
  for (const t of tasks.filter((task) => task.ownerType === "couple")) {
    await createRemindersForTask(client, venueId, t.id, t.dueDate, t);
  }

  return { ok: true };
}

/** Generate task_reminder records for a newly-created event task.
 *  All reminders are created in 'pending' status — the Sprint 44 delivery engine will process them.
 */
async function createRemindersForTask(
  client: DbClient,
  venueId: string,
  eventTaskId: string,
  dueDate: string,          // "YYYY-MM-DD"
  task: Pick<PlaybookTask, "ownerType" | "reminderBeforeDays" | "escalationAfterDays" | "notifyOnAssign">,
): Promise<void> {
  const reminders: Array<{
    venue_id: string; event_task_id: string;
    reminder_type: string; notify_role: string; scheduled_for: string;
  }> = [];

  const notifyRole: TaskReminderRole = task.ownerType === "couple" ? "couple"
    : task.ownerType === "vendor" ? "vendor"
    : "coordinator";

  const beforeDays = task.reminderBeforeDays ?? DEFAULT_REMINDER_BEFORE_DAYS;
  const dueMidnight = dueDate + "T08:00:00Z"; // send reminder at 8am UTC on that day

  // Pre-due-date reminders (e.g., 7 days before, 3 days before, 1 day before)
  for (const days of beforeDays) {
    const scheduledFor = offsetDatetime(dueMidnight, -days);
    // Only schedule if the reminder is in the future
    if (new Date(scheduledFor) > new Date()) {
      reminders.push({
        venue_id: venueId, event_task_id: eventTaskId,
        reminder_type: "upcoming", notify_role: notifyRole,
        scheduled_for: scheduledFor,
      });
    }
  }

  // Day-of reminder
  reminders.push({
    venue_id: venueId, event_task_id: eventTaskId,
    reminder_type: "due_today", notify_role: notifyRole,
    scheduled_for: dueMidnight,
  });

  // Overdue escalation (always to coordinator regardless of task owner)
  if (task.escalationAfterDays) {
    reminders.push({
      venue_id: venueId, event_task_id: eventTaskId,
      reminder_type: "escalation", notify_role: "coordinator",
      scheduled_for: offsetDatetime(dueMidnight, task.escalationAfterDays),
    });
  } else {
    // Default: escalate to coordinator 3 days after overdue if no custom rule
    reminders.push({
      venue_id: venueId, event_task_id: eventTaskId,
      reminder_type: "overdue", notify_role: "coordinator",
      scheduled_for: offsetDatetime(dueMidnight, 3),
    });
  }

  if (!reminders.length) return;
  await client.from("task_reminders").insert(reminders);
}

/** Cancel all pending reminders for a task (called when task is completed or waived). */
export async function cancelRemindersForTask(client: DbClient, venueId: string, eventTaskId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("task_reminders") as any)
    .update({ status: "cancelled" })
    .eq("event_task_id", eventTaskId)
    .eq("venue_id", venueId)
    .eq("status", "pending");
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Event-date-change sync (Product Decisions, 2026-07-08): relative due dates
 * stay synchronized with the event date automatically, until an individual
 * task is explicitly overridden — recalculation skips locked tasks rather
 * than silently discarding a deliberate manual change. Also re-derives
 * reminders, since one scheduled against the old due date would otherwise
 * fire at the wrong offset from the new one.
 */
export async function recalculateEventTaskDueDates(
  client: DbClient,
  venueId: string,
  eventId: string,
  newEventDate: string,
): Promise<void> {
  const { data, error } = await client.from("event_tasks")
    .select("id, days_offset, reminder_before_days, escalation_after_days, owner_type")
    .eq("venue_id", venueId).eq("event_id", eventId)
    .eq("due_date_rule_kind", "relative_to_event")
    .eq("due_date_locked", false)
    .not("status", "in", "(complete,waived)");
  if (error) throw error;

  type Row = { id: string; days_offset: number; reminder_before_days: number[] | null; escalation_after_days: number | null; owner_type: string };
  for (const t of (data ?? []) as Row[]) {
    const newDueDate = offsetDate(newEventDate, t.days_offset);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("event_tasks") as any).update({ due_date: newDueDate }).eq("id", t.id).eq("venue_id", venueId);
    await cancelRemindersForTask(client, venueId, t.id);
    await createRemindersForTask(client, venueId, t.id, newDueDate, {
      ownerType: t.owner_type as PlaybookTask["ownerType"],
      reminderBeforeDays: t.reminder_before_days,
      escalationAfterDays: t.escalation_after_days,
      notifyOnAssign: false,
    });
  }
}

/** Coordinator manually overrides one task's due date on this event — locks it out of future event-date recalculation. */
export async function updateEventTaskDueDate(
  client: DbClient,
  venueId: string,
  taskId: string,
  newDueDate: string,
): Promise<void> {
  const { data, error: fetchError } = await client.from("event_tasks")
    .select("owner_type, reminder_before_days, escalation_after_days")
    .eq("id", taskId).eq("venue_id", venueId)
    .maybeSingle<{ owner_type: string; reminder_before_days: number[] | null; escalation_after_days: number | null }>();
  if (fetchError) throw fetchError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_tasks") as any)
    .update({ due_date: newDueDate, due_date_locked: true })
    .eq("id", taskId).eq("venue_id", venueId);
  if (error) throw error;

  await cancelRemindersForTask(client, venueId, taskId);
  if (data) {
    await createRemindersForTask(client, venueId, taskId, newDueDate, {
      ownerType: data.owner_type as PlaybookTask["ownerType"],
      reminderBeforeDays: data.reminder_before_days,
      escalationAfterDays: data.escalation_after_days,
      notifyOnAssign: false,
    });
  }
}

function offsetDatetime(datetimeStr: string, days: number): string {
  const d = new Date(datetimeStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function completeEventTask(
  client: DbClient,
  venueId: string,
  taskId: string,
  completedBy = "coordinator",
  sourceType?: string,
  sourceId?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: "complete", completed_at: new Date().toISOString(), completed_by: completedBy,
  };
  if (sourceType) patch.source_type = sourceType;
  if (sourceId) patch.source_id = sourceId;
  const { data } = await client.from("event_tasks")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any).eq("id", taskId).eq("venue_id", venueId)
    .select("title, event_id, notify_on_complete")
    .maybeSingle<{ title: string; event_id: string | null; notify_on_complete: boolean }>();
  // Cancel pending reminders — task is done, no more notifications needed
  await cancelRemindersForTask(client, venueId, taskId);
  // Unblock dependent tasks
  await unblockedependents(client, venueId, taskId);

  // notify_on_complete audit (Planning Execution — Release Completion): the
  // DB trigger notify_task_completed already covers completedBy IN
  // ('couple','vendor') unconditionally, ignoring this field entirely — so
  // the one real remaining gap this field could ever cover is a
  // coordinator's own completion, which that trigger explicitly excludes.
  // Gating on both completedBy = 'coordinator' and the task's own setting
  // means this can never double-fire alongside the DB trigger (the two
  // conditions are mutually exclusive by completedBy).
  if (completedBy === "coordinator" && data?.event_id && data.notify_on_complete) {
    await client.rpc("create_venue_notification", {
      p_venue_id: venueId,
      p_event_id: data.event_id,
      p_type: "task_completed_coordinator",
      p_title: "Task completed",
      p_body: `"${data.title}" was marked complete.`,
      p_link: `/events/${data.event_id}?tab=playbook`,
      p_emoji: "✅",
    });
  }
}

export async function updateEventTaskStatus(
  client: DbClient,
  venueId: string,
  taskId: string,
  status: "waived" | "pending",
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "pending") patch.completed_at = null; // un-complete or un-waive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("event_tasks") as any).update(patch).eq("id", taskId).eq("venue_id", venueId);
  // Waiving a required task is a deliberate, coordinator-approved decision
  // not to do it — exactly like completing it, anything waiting on it
  // should unblock. Without this, a waived (not completed) blocking task
  // left every dependent permanently stuck in "blocked" (Planning Release
  // Readiness Fixes).
  if (status === "waived") await unblockedependents(client, venueId, taskId);
}

/** Auto-complete tasks matching a trigger for a given event. */
export async function autoCompleteTrigger(
  client: DbClient,
  venueId: string,
  eventId: string,
  trigger: string,
  sourceType?: string,
  sourceId?: string,
): Promise<void> {
  const { data } = await client.from("event_tasks").select("id")
    .eq("venue_id", venueId).eq("event_id", eventId)
    .eq("auto_complete_trigger", trigger)
    .in("status", ["pending", "blocked", "overdue"]);
  for (const { id } of (data ?? []) as { id: string }[]) {
    await completeEventTask(client, venueId, id, "system", sourceType, sourceId);
  }
}

async function unblockedependents(client: DbClient, venueId: string, completedTaskId: string): Promise<void> {
  const { data: blocked } = await client.from("event_tasks").select("id")
    .eq("depends_on_event_task_id", completedTaskId).eq("status", "blocked").eq("venue_id", venueId);
  for (const { id } of (blocked ?? []) as { id: string }[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("event_tasks") as any).update({ status: "pending" }).eq("id", id).eq("venue_id", venueId);
  }
}

// ---- Event Readiness (replaces computeEventReadiness) -----------------------

export async function computeEventReadinessFromPlaybook(
  client: DbClient,
  venueId: string,
  clientId: string,
): Promise<EventReadiness | null> {
  // Find linked event
  const { data: events } = await client.from("events")
    .select("id, event_date").eq("venue_id", venueId).eq("client_id", clientId)
    .not("status", "in", "(cancelled,complete)").order("event_date").limit(1);
  const event = (events as { id: string; event_date: string }[] | null)?.[0];
  if (!event) return null;

  const tasks = await getEventTasks(client, venueId, event.id);
  if (!tasks.length) return null; // no playbook applied yet

  const required = tasks.filter((t) => t.isRequired);
  const optional = tasks.filter((t) => !t.isRequired);
  // A waived required task is a deliberate, coordinator-approved skip, not
  // an open requirement — it must count as satisfied the same way complete
  // does, or a single waived required task permanently caps this event's
  // readiness below 100%, forever (Planning Release Readiness Fixes).
  const completedRequired = required.filter((t) => t.status === "complete" || t.status === "waived").length;
  const completedOptional = optional.filter((t) => t.status === "complete").length;
  const score = required.length > 0 ? Math.round((completedRequired / required.length) * 100) : 0;

  return {
    score,
    completedRequired,
    totalRequired: required.length,
    completedOptional,
    totalOptional: optional.length,
    tasks,
    blockedCount: tasks.filter((t) => t.status === "blocked").length,
    overdueCount: tasks.filter((t) => t.status === "overdue").length,
  };
}

function readinessFromTasks(tasks: EventTask[]): EventReadiness | null {
  if (!tasks.length) return null;
  const required = tasks.filter((t) => t.isRequired);
  const optional = tasks.filter((t) => !t.isRequired);
  // See the matching comment in computeEventReadinessFromPlaybook above —
  // waived must count as satisfied for a required task.
  const completedRequired = required.filter((t) => t.status === "complete" || t.status === "waived").length;
  const completedOptional = optional.filter((t) => t.status === "complete").length;
  return {
    score: required.length > 0 ? Math.round((completedRequired / required.length) * 100) : 0,
    completedRequired, totalRequired: required.length,
    completedOptional, totalOptional: optional.length,
    tasks,
    blockedCount: tasks.filter((t) => t.status === "blocked").length,
    overdueCount: tasks.filter((t) => t.status === "overdue").length,
  };
}

// Client Planning and Venue Workflow readiness, computed independently and
// never merged into one number (Planning Experience Review, 2026-07-08).
// Kind is derived from ownerType rather than stored on EventTask directly —
// the Builder guarantees 'couple' owner if-and-only-if the task came from a
// Client Planning playbook, so this is a reliable split without a new column.
export async function computeEventTaskReadinessByKind(
  client: DbClient,
  venueId: string,
  eventId: string,
): Promise<{ client: EventReadiness | null; venue: EventReadiness | null }> {
  const tasks = await getEventTasks(client, venueId, eventId);
  const clientTasks = tasks.filter((t) => t.ownerType === "couple");
  const venueTasks = tasks.filter((t) => t.ownerType !== "couple");
  return { client: readinessFromTasks(clientTasks), venue: readinessFromTasks(venueTasks) };
}

// ---- Internal Notes (event_tasks.notes) --------------------------------------
// Venue-only, event-scoped coordinator annotation. The column has existed
// since Sprint 43 but never had a real write path — see docs/product-backlog.md.

export async function updateEventTaskNotes(client: DbClient, venueId: string, taskId: string, notes: string): Promise<void> {
  const { error } = await client.from("event_tasks")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ notes: notes.trim() || null } as any)
    .eq("id", taskId).eq("venue_id", venueId);
  if (error) throw error;
}

// assigned_to_staff_id was already read everywhere (Calendar's own staff
// filter, Request creation metadata, the contact-lookup used for the
// couple-facing contact line) but had no write path at all — "assign
// staff" simply didn't work through the product (Planning Release
// Readiness Fixes). null unassigns; both the FK's own ON DELETE SET NULL
// and this explicit null path share one meaning, "no one assigned."
export async function updateEventTaskAssignment(
  client: DbClient, venueId: string, taskId: string, staffId: string | null,
): Promise<void> {
  const { data, error } = await client.from("event_tasks")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ assigned_to_staff_id: staffId, assigned_at: staffId ? new Date().toISOString() : null } as any)
    .eq("id", taskId).eq("venue_id", venueId)
    .select("title, event_id, notify_on_assign")
    .maybeSingle<{ title: string; event_id: string | null; notify_on_assign: boolean }>();
  if (error) throw error;

  // Repairs notify_on_assign (Planning Execution — Release Completion):
  // real, Builder-configurable, stored correctly, previously read nowhere.
  // Gated on the task's own setting, same as the Builder presents it — some
  // tasks are meant to announce their assignment, others aren't, and this
  // makes that actual coordinator decision take effect for the first time,
  // rather than silently replacing it with an always-on rule. Only fires on
  // a real assignment (never on unassign — nothing to announce there), via
  // the same venue-wide notification mechanism escalation already uses;
  // create_venue_notification never throws, so a notification failure can
  // never block the assignment itself.
  if (staffId && data?.event_id && data.notify_on_assign) {
    const { data: staff } = await client.from("venue_staff").select("full_name").eq("id", staffId).maybeSingle<{ full_name: string }>();
    const staffName = staff?.full_name ?? "a team member";
    await client.rpc("create_venue_notification", {
      p_venue_id: venueId,
      p_event_id: data.event_id,
      p_type: "task_assigned",
      p_title: "Task assigned",
      p_body: `"${data.title}" was assigned to ${staffName}.`,
      p_link: `/events/${data.event_id}?tab=playbook`,
      p_emoji: "📌",
    });
  }
}

// ---- Scheduled Activity (Calendar Integration — Phase 1) ---------------------
// Additive to due-date behavior, never a replacement — dueDate/dueDateLocked
// are untouched by this. Clearing (all four null) is a normal, expected call
// shape, not an edge case: a coordinator un-marking a task as a scheduled
// activity should return it to plain due-date-only exactly as it started.

export type ScheduleInput = {
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  location: string | null;
};

export async function updateEventTaskSchedule(
  client: DbClient,
  venueId: string,
  taskId: string,
  input: ScheduleInput,
): Promise<void> {
  const { error } = await client.from("event_tasks")
    .update({
      scheduled_date: input.scheduledDate,
      scheduled_start_time: input.scheduledStartTime,
      scheduled_end_time: input.scheduledEndTime,
      location: input.location?.trim() || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("id", taskId).eq("venue_id", venueId);
  if (error) throw error;
}

/** Links (or unlinks, when requestId is null) this task to a Request Framework record. Additive — does not affect task status. */
export async function setEventTaskRequest(client: DbClient, venueId: string, taskId: string, requestId: string | null): Promise<void> {
  const { error } = await client.from("event_tasks")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ request_id: requestId } as any)
    .eq("id", taskId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Related Context links ---------------------------------------------------

type ContextLinkRow = {
  id: string; event_task_id: string; created_at: string;
  conversation_message_id: string | null; document_id: string | null; timeline_entry_id: string | null;
  link_url: string | null; link_label: string | null;
};

const CONTEXT_LINK_COLUMNS = "id, event_task_id, created_at, conversation_message_id, document_id, timeline_entry_id, link_url, link_label";

export async function getEventTaskContextLinks(client: DbClient, venueId: string, eventTaskId: string): Promise<EventTaskContextLink[]> {
  const { data, error } = await client.from("event_task_context_links")
    .select(CONTEXT_LINK_COLUMNS)
    .eq("venue_id", venueId).eq("event_task_id", eventTaskId)
    .order("created_at");
  if (error) throw error;
  return resolveContextLinkRows(client, (data ?? []) as ContextLinkRow[]);
}

/** All Related Context links for every task on an event, in one query per source type rather than one per task. */
export async function getEventTaskContextLinksForEvent(client: DbClient, venueId: string, eventId: string): Promise<Record<string, EventTaskContextLink[]>> {
  const { data, error } = await client.from("event_task_context_links")
    .select(`${CONTEXT_LINK_COLUMNS}, event_tasks!inner(event_id)`)
    .eq("venue_id", venueId).eq("event_tasks.event_id", eventId)
    .order("created_at");
  if (error) throw error;
  const links = await resolveContextLinkRows(client, (data ?? []) as ContextLinkRow[]);
  const byTask: Record<string, EventTaskContextLink[]> = {};
  for (const link of links) {
    (byTask[link.eventTaskId] ??= []).push(link);
  }
  return byTask;
}

async function resolveContextLinkRows(client: DbClient, rows: ContextLinkRow[]): Promise<EventTaskContextLink[]> {
  if (!rows.length) return [];

  const messageIds = rows.map((r) => r.conversation_message_id).filter((v): v is string => !!v);
  const documentIds = rows.map((r) => r.document_id).filter((v): v is string => !!v);
  const timelineIds = rows.map((r) => r.timeline_entry_id).filter((v): v is string => !!v);

  const [messages, documents, timelineEntries] = await Promise.all([
    messageIds.length
      ? client.from("conversation_messages").select("id, sender_type, channel, body, sent_at").in("id", messageIds)
      : Promise.resolve({ data: [] as { id: string; sender_type: string; channel: string; body: string; sent_at: string }[] }),
    documentIds.length
      ? client.from("documents").select("id, name, file_name").in("id", documentIds)
      : Promise.resolve({ data: [] as { id: string; name: string; file_name: string }[] }),
    timelineIds.length
      ? client.from("timeline_entries").select("id, title, entry_time").in("id", timelineIds)
      : Promise.resolve({ data: [] as { id: string; title: string; entry_time: string | null }[] }),
  ]);

  const messageById = new Map((messages.data ?? []).map((m) => [m.id, m]));
  const documentById = new Map((documents.data ?? []).map((d) => [d.id, d]));
  const timelineById = new Map((timelineEntries.data ?? []).map((t) => [t.id, t]));

  return rows.map((r): EventTaskContextLink | null => {
    if (r.conversation_message_id) {
      const m = messageById.get(r.conversation_message_id);
      if (!m) return null; // message deleted out from under the link; skip rather than render a broken row
      return {
        id: r.id, eventTaskId: r.event_task_id, sourceType: "conversation_message", sourceId: r.conversation_message_id,
        createdAt: r.created_at,
        label: m.channel === "internal_note" ? "Internal Note" : "Conversation",
        detail: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
      };
    }
    if (r.document_id) {
      const d = documentById.get(r.document_id);
      if (!d) return null;
      return { id: r.id, eventTaskId: r.event_task_id, sourceType: "document", sourceId: r.document_id, createdAt: r.created_at, label: d.name || d.file_name, detail: null };
    }
    if (r.timeline_entry_id) {
      const t = timelineById.get(r.timeline_entry_id);
      if (!t) return null;
      return { id: r.id, eventTaskId: r.event_task_id, sourceType: "timeline_entry", sourceId: r.timeline_entry_id, createdAt: r.created_at, label: t.title, detail: t.entry_time };
    }
    if (r.link_url) {
      return { id: r.id, eventTaskId: r.event_task_id, sourceType: "link", sourceId: r.link_url, createdAt: r.created_at, label: r.link_label || r.link_url, detail: r.link_label ? r.link_url : null };
    }
    return null;
  }).filter((l): l is EventTaskContextLink => l !== null);
}

export async function addEventTaskContextLink(
  client: DbClient, venueId: string, eventTaskId: string,
  sourceType: EventTaskContextSourceType, sourceId: string, linkLabel?: string,
): Promise<void> {
  const row: Record<string, unknown> = { venue_id: venueId, event_task_id: eventTaskId };
  if (sourceType === "link") { row.link_url = sourceId; row.link_label = linkLabel?.trim() || null; }
  else {
    const column = sourceType === "conversation_message" ? "conversation_message_id" : sourceType === "document" ? "document_id" : "timeline_entry_id";
    row[column] = sourceId;
  }
  const { error } = await client.from("event_task_context_links").insert(row);
  if (error && error.code !== "23505") throw error; // 23505 = already linked, treat as a no-op
}

export async function removeEventTaskContextLink(client: DbClient, venueId: string, linkId: string): Promise<void> {
  const { error } = await client.from("event_task_context_links").delete().eq("id", linkId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Template attachments (Definition time) -----------------------------------
// What a task needs to get done — real multi-attachment support (an uploaded
// file, an existing venue document, or a web link), replacing the old single
// resource_url/resource_label field (Planning Templates UX Rebuild, 2026-07-09).

type AttachmentRow = { id: string; playbook_task_id: string; document_id: string | null; link_url: string | null; link_label: string | null; sort_order: number; created_at: string; };

export async function getPlaybookTaskAttachments(client: DbClient, venueId: string, playbookTaskId: string): Promise<PlaybookTaskAttachment[]> {
  const { data, error } = await client.from("playbook_task_attachments")
    .select("id, playbook_task_id, document_id, link_url, link_label, sort_order, created_at")
    .eq("venue_id", venueId).eq("playbook_task_id", playbookTaskId)
    .order("sort_order").order("created_at");
  if (error) throw error;
  return resolveAttachmentRows(client, (data ?? []) as AttachmentRow[]);
}

/** All attachments for every task in a template, in one query per source type rather than one per task. */
export async function getPlaybookTaskAttachmentsForTemplate(client: DbClient, venueId: string, templateId: string): Promise<Record<string, PlaybookTaskAttachment[]>> {
  const { data, error } = await client.from("playbook_task_attachments")
    .select("id, playbook_task_id, document_id, link_url, link_label, sort_order, created_at, playbook_tasks!inner(template_id)")
    .eq("venue_id", venueId).eq("playbook_tasks.template_id", templateId)
    .order("sort_order").order("created_at");
  if (error) throw error;
  const attachments = await resolveAttachmentRows(client, (data ?? []) as AttachmentRow[]);
  const byTask: Record<string, PlaybookTaskAttachment[]> = {};
  for (const a of attachments) (byTask[a.playbookTaskId] ??= []).push(a);
  return byTask;
}

async function resolveAttachmentRows(client: DbClient, rows: AttachmentRow[]): Promise<PlaybookTaskAttachment[]> {
  if (!rows.length) return [];
  const documentIds = rows.map((r) => r.document_id).filter((v): v is string => !!v);
  const { data: documents } = documentIds.length
    ? await client.from("documents").select("id, name, file_name").in("id", documentIds)
    : { data: [] as { id: string; name: string; file_name: string }[] };
  const documentById = new Map((documents ?? []).map((d) => [d.id, d]));

  return rows.map((r): PlaybookTaskAttachment => ({
    id: r.id, playbookTaskId: r.playbook_task_id, documentId: r.document_id,
    linkUrl: r.link_url, linkLabel: r.link_label, sortOrder: r.sort_order, createdAt: r.created_at,
    label: r.document_id ? (documentById.get(r.document_id)?.name || documentById.get(r.document_id)?.file_name || "Document") : (r.link_label || r.link_url || "Link"),
  }));
}

export async function addPlaybookTaskAttachment(
  client: DbClient, venueId: string, playbookTaskId: string,
  attachment: { documentId: string } | { linkUrl: string; linkLabel: string | null },
  sortOrder: number,
): Promise<void> {
  const row: Record<string, unknown> = { venue_id: venueId, playbook_task_id: playbookTaskId, sort_order: sortOrder };
  if ("documentId" in attachment) row.document_id = attachment.documentId;
  else { row.link_url = attachment.linkUrl; row.link_label = attachment.linkLabel?.trim() || null; }
  const { error } = await client.from("playbook_task_attachments").insert(row);
  if (error) throw error;
}

export async function removePlaybookTaskAttachment(client: DbClient, venueId: string, attachmentId: string): Promise<void> {
  const { error } = await client.from("playbook_task_attachments").delete().eq("id", attachmentId).eq("venue_id", venueId);
  if (error) throw error;
}

/** Duplicate a template: carry a source task's attachments over to its copy. */
async function copyTaskAttachments(client: DbClient, venueId: string, sourceTaskId: string, newTaskId: string): Promise<void> {
  const attachments = await getPlaybookTaskAttachments(client, venueId, sourceTaskId);
  for (const a of attachments) {
    await addPlaybookTaskAttachment(
      client, venueId, newTaskId,
      a.documentId ? { documentId: a.documentId } : { linkUrl: a.linkUrl!, linkLabel: a.linkLabel },
      a.sortOrder,
    );
  }
}

/** Apply a playbook to an event: a template task's attachments become the event task's starting Related Context — same mechanism, not a copy of content (documents stay referenced, not duplicated). */
async function copyAttachmentsToContextLinks(client: DbClient, venueId: string, playbookTaskId: string, eventTaskId: string): Promise<void> {
  const attachments = await getPlaybookTaskAttachments(client, venueId, playbookTaskId);
  for (const a of attachments) {
    if (a.documentId) await addEventTaskContextLink(client, venueId, eventTaskId, "document", a.documentId);
    else if (a.linkUrl) await addEventTaskContextLink(client, venueId, eventTaskId, "link", a.linkUrl, a.linkLabel ?? undefined);
  }
}

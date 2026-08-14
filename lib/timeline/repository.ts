/**
 * Timeline data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import * as playbooksRepo from "@/lib/playbooks/repository";
import {
  clampDayOffset,
  compareTimelineEntries,
  minutesToTime,
  resolveEntryTimeFromOffset,
  timeToMinutes,
  type TimelineTemplate,
} from "@/lib/timeline/constants";
import type {
  TimelineAudience, TimelineEntry, TimelineEntryAttachment, TimelineEntryInput,
  TimelineEntryLink, TimelineEntryStatus, TimelineLockState, TimelineOwner, TimelineRelatedLink, TimelineRelatedSourceType, TimelineSection,
} from "@/lib/timeline/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type EntryRow = {
  id: string; venue_id: string; event_id: string;
  title: string; description: string | null; notes: string | null;
  entry_time: string | null; day_offset: number; sort_order: number;
  audiences: string[]; section_id: string | null;
  owner: TimelineOwner; lock_state: TimelineLockState;
  status: TimelineEntryStatus;
  assigned_to_staff_id: string | null;
  created_at: string; updated_at: string;
};

type SectionRow = { id: string; venue_id: string; event_id: string; name: string; sort_order: number; client_can_add: boolean; created_at: string; updated_at: string; };
type LinkRow = { id: string; venue_id: string; timeline_entry_id: string; url: string; label: string | null; sort_order: number; created_at: string; };
type AttachmentRow = { id: string; venue_id: string; timeline_entry_id: string; document_id: string; sort_order: number; created_at: string; };

function mapEntry(r: EntryRow): TimelineEntry {
  return {
    id: r.id, venueId: r.venue_id, eventId: r.event_id,
    title: r.title, description: r.description, notes: r.notes,
    entryTime: r.entry_time?.slice(0, 5) ?? null,
    dayOffset: r.day_offset ?? 0,
    audiences: (r.audiences ?? ["venue"]) as TimelineAudience[],
    sectionId: r.section_id,
    sortOrder: r.sort_order,
    owner: r.owner ?? "venue",
    lockState: r.lock_state ?? "editable",
    status: r.status ?? "not_started",
    assignedToStaffId: r.assigned_to_staff_id,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

async function resolveClampedDayOffset(
  client: DbClient, eventId: string, dayOffset: number | null | undefined,
): Promise<number> {
  const { data } = await client.from("events")
    .select("event_date, event_end_date")
    .eq("id", eventId)
    .maybeSingle<{ event_date: string | null; event_end_date: string | null }>();
  return clampDayOffset(dayOffset ?? 0, data?.event_date ?? null, data?.event_end_date);
}

function mapSection(r: SectionRow): TimelineSection {
  return { id: r.id, venueId: r.venue_id, eventId: r.event_id, name: r.name, sortOrder: r.sort_order, clientCanAdd: r.client_can_add, createdAt: r.created_at, updatedAt: r.updated_at };
}

/** Venue never owns guest publication — strip on write so legacy tags can't re-stick. */
function sanitizeVenueAudiences(audiences: TimelineAudience[] | undefined): TimelineAudience[] {
  const next = (audiences ?? ["venue"]).filter((a) => a !== "guests");
  return next.length > 0 ? next : ["venue"];
}

// ---- Entries -------------------------------------------------------------------

/**
 * The coordinator-facing read, for every existing consumer (the Timeline
 * tab, Wedding Day Ops, the print view, booking overview summary, the
 * "link a timeline entry" picker in Planning). Sources from the one
 * merged venue-facing view (§12, refined 2026-07-17) — the venue's own
 * live items plus the client's latest SUBMITTED snapshot, never the
 * client's live private draft (which would otherwise leak straight into
 * the coordinator's own editor, the exact Workspace Sovereignty violation
 * this whole model exists to prevent). Order is day_offset, then time ASC
 * nulls last, then sort_order, then created_at — the SQL side already
 * orders each of the two merged sources this way; re-sorted here once
 * more since concatenating two internally-sorted arrays doesn't
 * interleave them into one global order.
 */
export async function getTimelineEntries(
  client: DbClient, venueId: string, eventId: string,
): Promise<TimelineEntry[]> {
  const { data, error } = await client.rpc("get_event_timeline_merged", { p_event_id: eventId });
  if (error) throw error;
  const d = (data ?? {}) as { entries?: Record<string, unknown>[] };
  const entries = (d.entries ?? []).map((e): TimelineEntry => ({
    id: e.id as string, venueId, eventId,
    title: e.title as string, description: (e.description as string | null) ?? null,
    notes: (e.notes as string | null) ?? null,
    entryTime: (e.entryTime as string | null)?.slice(0, 5) ?? null,
    dayOffset: (e.dayOffset as number | null | undefined) ?? 0,
    audiences: (e.audiences ?? []) as TimelineAudience[],
    sectionId: (e.sectionId as string | null) ?? null,
    sortOrder: (e.sortOrder as number) ?? 0,
    owner: e.owner as TimelineOwner,
    lockState: e.lockState as TimelineLockState,
    status: (e.status as TimelineEntryStatus) ?? "not_started",
    assignedToStaffId: (e.assignedToStaffId as string | null) ?? null,
    createdAt: (e.createdAt as string | null) ?? "",
    updatedAt: (e.updatedAt as string | null) ?? "",
  }));
  entries.sort(compareTimelineEntries);
  return entries;
}

// Only ever called from the coordinator editor — every row it creates is
// owner='venue' (the client's own items are created exclusively through
// the portal RPCs, see supabase/migrations/20261029020000_timeline_portal_rpcs.sql).
// Structural milestones default locked (§12); the coordinator can toggle
// a specific item to editable if it's more of a flexible note.
export async function insertEntry(
  client: DbClient, venueId: string, eventId: string, input: TimelineEntryInput,
): Promise<TimelineEntry> {
  const dayOffset = await resolveClampedDayOffset(client, eventId, input.dayOffset);
  const { data, error } = await client.from("timeline_entries")
    .insert({
      venue_id: venueId, event_id: eventId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      notes: input.notes?.trim() || null,
      entry_time: input.entryTime || null,
      day_offset: dayOffset,
      audiences: sanitizeVenueAudiences(input.audiences),
      section_id: input.sectionId ?? null,
      sort_order: input.sortOrder ?? 0,
      owner: "venue",
      lock_state: input.lockState ?? "locked",
      status: input.status ?? "not_started",
      assigned_to_staff_id: input.assignedToStaffId ?? null,
    })
    .select().single<EntryRow>();
  if (error) throw error;
  return mapEntry(data);
}

/**
 * Coordinator-side entry update, via the Timeline editor's own save form.
 * Refuses outright on anything that isn't owner='venue': the couple's own
 * items are never edited through this path — the coordinator's merged
 * view renders them read-only, sourced from the latest submission
 * snapshot, not a live editable row. Defense-in-depth: this function has
 * no portal-token boundary of its own to otherwise rely on, and a
 * client-owned row still physically exists live in this table (so day-of
 * status tracking keeps working, per Q3) — that's not an invitation for
 * the coordinator's own content-save flow to mutate the couple's
 * still-private draft. Day-of status updates go through
 * update_timeline_entry_status (Wedding Day Dashboard), not this content path.
 */
export async function updateEntry(
  client: DbClient, venueId: string, entryId: string, input: TimelineEntryInput,
): Promise<void> {
  const { data: current } = await client.from("timeline_entries")
    .select("owner, event_id, day_offset")
    .eq("id", entryId).eq("venue_id", venueId)
    .maybeSingle<{ owner: TimelineOwner; event_id: string; day_offset: number }>();
  if (current?.owner !== "venue") throw new Error("This item belongs to the couple's own planning timeline and can't be edited here.");

  const dayOffset = await resolveClampedDayOffset(
    client, current.event_id, input.dayOffset !== undefined ? input.dayOffset : current.day_offset,
  );
  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    entry_time: input.entryTime || null,
    day_offset: dayOffset,
  };
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (input.sectionId !== undefined) patch.section_id = input.sectionId;
  if (input.lockState !== undefined) patch.lock_state = input.lockState;
  if (input.audiences !== undefined) patch.audiences = sanitizeVenueAudiences(input.audiences);
  if (input.status !== undefined) patch.status = input.status;
  if (input.assignedToStaffId !== undefined) patch.assigned_to_staff_id = input.assignedToStaffId;

  const { error } = await client.from("timeline_entries")
    .update(patch)
    .eq("id", entryId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Just the submission status (for a "last submitted" indicator on the
 * coordinator side, if ever needed) without re-fetching the full merged
 * entry list.
 */
export async function getLastTimelineSubmission(client: DbClient, venueId: string, eventId: string): Promise<string | null> {
  const { data, error } = await client.from("timeline_submissions")
    .select("created_at").eq("event_id", eventId).eq("venue_id", venueId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle<{ created_at: string }>();
  if (error) throw error;
  return data?.created_at ?? null;
}

/**
 * Same ownership guard as updateEntry, same reason — the coordinator can
 * only ever delete their own items through this path.
 *
 * Release Readiness Reconciliation remediation: `timeline_entries_delete_gate`
 * (`20261002000000_tr_g6_core_object_delete_role_gate.sql`) restricts DELETE
 * to Owner/Manager at the RLS layer, but this previously only checked
 * `error` — a RESTRICTIVE policy blocks a disallowed delete by matching zero
 * rows, not by raising one, so a Coordinator/Staff attempt was silently
 * no-op-ing while the caller reported success. `.select("id")` surfaces
 * which row actually matched, same fix shape already shipped for
 * contracts/payments/invoices. The ownership check now also returns a
 * result instead of throwing, matching that same established pattern.
 */
export async function deleteEntry(
  client: DbClient, venueId: string, entryId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: current } = await client.from("timeline_entries").select("owner").eq("id", entryId).eq("venue_id", venueId).maybeSingle<{ owner: TimelineOwner }>();
  if (current?.owner !== "venue") {
    return { ok: false, message: "This item belongs to the couple's own planning timeline and can't be deleted here." };
  }

  const { data, error } = await client.from("timeline_entries")
    .delete().eq("id", entryId).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    return { ok: false, message: "Only an Owner or Manager can delete a timeline item." };
  }
  return { ok: true };
}

/**
 * Delay recovery — "push everything after this entry back by N minutes."
 * Timeline entries have no duration/dependency model (a deliberate,
 * documented open question — docs/shared-template-architecture.md), so
 * recovering from a late-running wedding day today meant re-editing every
 * subsequent entry's time by hand. This shifts every timed entry strictly
 * later than the anchor entry's own time, in one write, without inventing
 * durations or dependencies — a bulk update over the existing point-in-time
 * field, not a redesign (Timeline Release Readiness, UX Improvement #1).
 */
export async function shiftEntriesAfter(
  client: DbClient, venueId: string, eventId: string, afterEntryId: string, minutesDelta: number,
): Promise<{ shiftedCount: number }> {
  // Same ownership guard as updateEntry/deleteEntry — a coordinator-only
  // recovery action never reaches into and re-times a couple's own private
  // planning items, which this surface can't even see live anyway.
  const { data: anchor, error: anchorError } = await client
    .from("timeline_entries")
    .select("entry_time, day_offset")
    .eq("id", afterEntryId).eq("venue_id", venueId).eq("event_id", eventId).eq("owner", "venue")
    .maybeSingle<{ entry_time: string | null; day_offset: number }>();
  if (anchorError) throw anchorError;
  if (!anchor?.entry_time) return { shiftedCount: 0 };
  const anchorDay = anchor.day_offset ?? 0;

  const { data: rows, error: fetchError } = await client
    .from("timeline_entries")
    .select("id, entry_time, day_offset")
    .eq("venue_id", venueId).eq("event_id", eventId).eq("owner", "venue")
    .eq("day_offset", anchorDay)
    .not("entry_time", "is", null)
    .gt("entry_time", anchor.entry_time);
  if (fetchError) throw fetchError;

  const toShift = (rows ?? []) as { id: string; entry_time: string }[];
  for (const row of toShift) {
    const newTime = minutesToTime(timeToMinutes(row.entry_time.slice(0, 5)) + minutesDelta);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from("timeline_entries") as any)
      .update({ entry_time: newTime }).eq("id", row.id).eq("venue_id", venueId);
    if (error) throw error;
  }
  return { shiftedCount: toShift.length };
}

/**
 * Move an entry up or down within the same entry_time group.
 * Swaps the sort_order of the target and its neighbour. Kept unchanged —
 * the Timeline tab now drives reordering through reorderEntries (drag), but
 * this stays available and correct for any other caller.
 */
export async function reorderEntry(
  client: DbClient, venueId: string, eventId: string,
  entryId: string, direction: "up" | "down",
): Promise<void> {
  // Same ownership guard as updateEntry/reorderEntries — scoped to
  // owner='venue' so this coordinator-only path can never read or swap
  // sort_order on a couple-owned row that slipped through as `entryId`.
  const { data, error } = await client
    .from("timeline_entries").select("id, entry_time, day_offset, sort_order")
    .eq("event_id", eventId).eq("venue_id", venueId).eq("owner", "venue")
    .order("day_offset", { ascending: true })
    .order("entry_time", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const entries = data as { id: string; entry_time: string | null; day_offset: number; sort_order: number }[];

  const idx = entries.findIndex((e) => e.id === entryId);
  if (idx === -1) return;

  const neighbourIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighbourIdx < 0 || neighbourIdx >= entries.length) return;

  const current = entries[idx];
  const neighbour = entries[neighbourIdx];
  // Only swap within the same day + time group
  if (current.day_offset !== neighbour.day_offset || current.entry_time !== neighbour.entry_time) return;

  await Promise.all([
    client.from("timeline_entries").update({ sort_order: neighbour.sort_order }).eq("id", current.id),
    client.from("timeline_entries").update({ sort_order: current.sort_order }).eq("id", neighbour.id),
  ]);
}

/** Drag-to-reorder within/between sections (and optionally days): one row per entry with its new section, day, and position. */
// Same ownership guard as updateEntry — a client-owned item renders
// read-only in the merged coordinator view, so drag-reordering should
// never actually target one, but this is the drag-drop path's own
// defense-in-depth against a stray id slipping through.
export async function reorderEntries(
  client: DbClient, venueId: string, updates: { id: string; sectionId: string | null; sortOrder: number; dayOffset?: number }[],
): Promise<void> {
  if (updates.length === 0) return;
  const { data: owned } = await client.from("timeline_entries").select("id, event_id")
    .eq("venue_id", venueId).eq("owner", "venue").in("id", updates.map((u) => u.id));
  const ownedById = new Map((owned ?? []).map((r) => [(r as { id: string; event_id: string }).id, (r as { id: string; event_id: string }).event_id]));
  for (const u of updates) {
    const eventId = ownedById.get(u.id);
    if (!eventId) continue;
    const patch: Record<string, unknown> = { section_id: u.sectionId, sort_order: u.sortOrder };
    if (u.dayOffset !== undefined) {
      patch.day_offset = await resolveClampedDayOffset(client, eventId, u.dayOffset);
    }
    const { error } = await client.from("timeline_entries")
      .update(patch)
      .eq("id", u.id).eq("venue_id", venueId);
    if (error) throw error;
  }
}

/**
 * Apply a hardcoded booking-picker starter to an event.
 * When minutesOffset is null, entry_time stays empty (no invented times).
 * dayOffset is copied through (Wedding Weekend uses 0/1/2).
 * Appends to any existing entries — does not replace them.
 */
export async function applyTemplate(
  client: DbClient, venueId: string, eventId: string,
  template: TimelineTemplate, startTime: string | null,
): Promise<void> {
  const rows = template.entries.map((te, i) => ({
    venue_id: venueId,
    event_id: eventId,
    title: te.title,
    description: te.description ?? null,
    entry_time: resolveEntryTimeFromOffset(te.minutesOffset, startTime),
    day_offset: Math.max(0, Math.trunc(te.dayOffset ?? 0)),
    sort_order: i,
  }));

  const { error } = await client.from("timeline_entries").insert(rows);
  if (error) throw error;
}

// ---- Sections ------------------------------------------------------------------

export async function getSections(client: DbClient, venueId: string, eventId: string): Promise<TimelineSection[]> {
  const { data, error } = await client.from("timeline_sections").select("*")
    .eq("event_id", eventId).eq("venue_id", venueId).order("sort_order");
  if (error) throw error;
  return (data as SectionRow[]).map(mapSection);
}

export async function insertSection(client: DbClient, venueId: string, eventId: string, name: string, sortOrder: number): Promise<TimelineSection> {
  const { data, error } = await client.from("timeline_sections")
    .insert({ venue_id: venueId, event_id: eventId, name: name.trim(), sort_order: sortOrder })
    .select().single<SectionRow>();
  if (error) throw error;
  return mapSection(data);
}

export async function renameSection(client: DbClient, venueId: string, sectionId: string, name: string): Promise<void> {
  const { error } = await client.from("timeline_sections").update({ name: name.trim() }).eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setSectionClientCanAdd(client: DbClient, venueId: string, sectionId: string, clientCanAdd: boolean): Promise<void> {
  const { error } = await client.from("timeline_sections").update({ client_can_add: clientCanAdd }).eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

/** Un-sections its entries (section_id → null via ON DELETE SET NULL) rather than deleting them. */
export async function deleteSection(client: DbClient, venueId: string, sectionId: string): Promise<void> {
  const { error } = await client.from("timeline_sections").delete().eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * "Duplicate a section" (Timeline Experience Completion task) — a new
 * section plus its entries' core schedule fields (title/time/description/
 * notes/audiences/assignment). Links, attachments, and Related Items
 * aren't copied — Duplicate makes a fresh copy of the schedule, not every
 * cross-reference. Completion always resets to not_started on the copy.
 * Scoped to owner='venue' entries only — a coordinator action never
 * reaches into and copies a couple's own private planning items, which
 * this surface can't even see live under the Owner/Lock/Visibility model.
 */
export async function duplicateSection(
  client: DbClient, venueId: string, eventId: string, sourceSectionId: string, sortOrder: number,
): Promise<{ section: TimelineSection; entries: TimelineEntry[] }> {
  const { data: sourceRow, error: sourceError } = await client.from("timeline_sections")
    .select("*").eq("id", sourceSectionId).eq("venue_id", venueId).maybeSingle<SectionRow>();
  if (sourceError) throw sourceError;
  if (!sourceRow) throw new Error("Section not found.");

  const newSection = await insertSection(client, venueId, eventId, `${sourceRow.name} (Copy)`, sortOrder);

  const { data: sourceEntryRows, error: entriesError } = await client.from("timeline_entries")
    .select("*").eq("section_id", sourceSectionId).eq("venue_id", venueId).eq("owner", "venue")
    .order("sort_order").order("created_at");
  if (entriesError) throw entriesError;
  const sourceEntries = (sourceEntryRows as EntryRow[]).map(mapEntry);

  if (sourceEntries.length === 0) return { section: newSection, entries: [] };

  const rows = sourceEntries.map((e, i) => ({
    venue_id: venueId, event_id: eventId, section_id: newSection.id,
    title: e.title, description: e.description, notes: e.notes, entry_time: e.entryTime,
    day_offset: e.dayOffset ?? 0,
    audiences: sanitizeVenueAudiences(e.audiences), owner: "venue" as const, lock_state: e.lockState,
    assigned_to_staff_id: e.assignedToStaffId, status: "not_started" as const,
    sort_order: i,
  }));
  const { data: inserted, error: insertError } = await client.from("timeline_entries").insert(rows).select();
  if (insertError) throw insertError;

  return { section: newSection, entries: (inserted as EntryRow[]).map(mapEntry) };
}

export async function reorderSections(client: DbClient, venueId: string, orderedSectionIds: string[]): Promise<void> {
  for (let i = 0; i < orderedSectionIds.length; i++) {
    const { error } = await client.from("timeline_sections").update({ sort_order: i }).eq("id", orderedSectionIds[i]).eq("venue_id", venueId);
    if (error) throw error;
  }
}

// ---- Links -----------------------------------------------------------------

export async function getEntryLinks(client: DbClient, venueId: string, timelineEntryId: string): Promise<TimelineEntryLink[]> {
  const { data, error } = await client.from("timeline_entry_links").select("*")
    .eq("timeline_entry_id", timelineEntryId).eq("venue_id", venueId).order("sort_order").order("created_at");
  if (error) throw error;
  return (data as LinkRow[]).map((r) => ({ id: r.id, timelineEntryId: r.timeline_entry_id, url: r.url, label: r.label, sortOrder: r.sort_order, createdAt: r.created_at }));
}

/** All links for every entry in an event, in one query per table rather than one per entry (flat fetch + JS grouping, not an embedded-relationship select). */
export async function getEntryLinksForEvent(client: DbClient, venueId: string, eventId: string): Promise<Record<string, TimelineEntryLink[]>> {
  const { data: entryRows, error: entryError } = await client.from("timeline_entries").select("id").eq("event_id", eventId).eq("venue_id", venueId);
  if (entryError) throw entryError;
  const entryIds = (entryRows ?? []).map((r) => (r as { id: string }).id);
  if (entryIds.length === 0) return {};

  const { data, error } = await client.from("timeline_entry_links").select("*").eq("venue_id", venueId).in("timeline_entry_id", entryIds);
  if (error) throw error;
  const byEntry: Record<string, TimelineEntryLink[]> = {};
  for (const r of (data ?? []) as LinkRow[]) {
    const link: TimelineEntryLink = { id: r.id, timelineEntryId: r.timeline_entry_id, url: r.url, label: r.label, sortOrder: r.sort_order, createdAt: r.created_at };
    (byEntry[r.timeline_entry_id] ??= []).push(link);
  }
  return byEntry;
}

export async function addEntryLink(client: DbClient, venueId: string, timelineEntryId: string, url: string, label: string | null, sortOrder: number): Promise<TimelineEntryLink> {
  const { data, error } = await client.from("timeline_entry_links")
    .insert({ venue_id: venueId, timeline_entry_id: timelineEntryId, url: url.trim(), label: label?.trim() || null, sort_order: sortOrder })
    .select().single<LinkRow>();
  if (error) throw error;
  return { id: data.id, timelineEntryId: data.timeline_entry_id, url: data.url, label: data.label, sortOrder: data.sort_order, createdAt: data.created_at };
}

export async function removeEntryLink(client: DbClient, venueId: string, linkId: string): Promise<void> {
  const { error } = await client.from("timeline_entry_links").delete().eq("id", linkId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Attachments -----------------------------------------------------------

async function resolveAttachmentRows(client: DbClient, rows: AttachmentRow[]): Promise<TimelineEntryAttachment[]> {
  if (!rows.length) return [];
  const documentIds = [...new Set(rows.map((r) => r.document_id))];
  const { data: docs, error } = await client.from("documents").select("id, name, file_name").in("id", documentIds);
  if (error) throw error;
  const docById = new Map((docs ?? []).map((d) => [d.id, d as { id: string; name: string; file_name: string }]));
  return rows
    .map((r): TimelineEntryAttachment | null => {
      const doc = docById.get(r.document_id);
      if (!doc) return null; // document deleted out from under the attachment; skip rather than render a broken row
      return { id: r.id, timelineEntryId: r.timeline_entry_id, documentId: r.document_id, sortOrder: r.sort_order, createdAt: r.created_at, label: doc.name || doc.file_name };
    })
    .filter((a): a is TimelineEntryAttachment => a !== null);
}

export async function getEntryAttachments(client: DbClient, venueId: string, timelineEntryId: string): Promise<TimelineEntryAttachment[]> {
  const { data, error } = await client.from("timeline_entry_attachments").select("*")
    .eq("timeline_entry_id", timelineEntryId).eq("venue_id", venueId).order("sort_order").order("created_at");
  if (error) throw error;
  return resolveAttachmentRows(client, (data ?? []) as AttachmentRow[]);
}

/** All attachments for every entry in an event, in one query per table rather than one per entry (flat fetch + JS grouping, not an embedded-relationship select). */
export async function getEntryAttachmentsForEvent(client: DbClient, venueId: string, eventId: string): Promise<Record<string, TimelineEntryAttachment[]>> {
  const { data: entryRows, error: entryError } = await client.from("timeline_entries").select("id").eq("event_id", eventId).eq("venue_id", venueId);
  if (entryError) throw entryError;
  const entryIds = (entryRows ?? []).map((r) => (r as { id: string }).id);
  if (entryIds.length === 0) return {};

  const { data, error } = await client.from("timeline_entry_attachments").select("*").eq("venue_id", venueId).in("timeline_entry_id", entryIds);
  if (error) throw error;
  const resolved = await resolveAttachmentRows(client, (data ?? []) as AttachmentRow[]);
  const byEntry: Record<string, TimelineEntryAttachment[]> = {};
  for (const a of resolved) (byEntry[a.timelineEntryId] ??= []).push(a);
  return byEntry;
}

export async function addEntryAttachment(client: DbClient, venueId: string, timelineEntryId: string, documentId: string, sortOrder: number): Promise<TimelineEntryAttachment> {
  const { data, error } = await client.from("timeline_entry_attachments")
    .insert({ venue_id: venueId, timeline_entry_id: timelineEntryId, document_id: documentId, sort_order: sortOrder })
    .select().single<AttachmentRow>();
  if (error) throw error;
  const [resolved] = await resolveAttachmentRows(client, [data]);
  if (!resolved) throw new Error("Document not found.");
  return resolved;
}

export async function removeEntryAttachment(client: DbClient, venueId: string, attachmentId: string): Promise<void> {
  const { error } = await client.from("timeline_entry_attachments").delete().eq("id", attachmentId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Related Items (Timeline Integration) ---------------------------------
// Planning reuses event_task_context_links as-is — that table already has a
// timeline_entry_id column, so this never creates a second record of the
// same relationship. Vendor/Floor Plan/Conversation/Invoice are new
// (timeline_entry_context_links), mirroring that table's shape.

type RelatedLinkRow = {
  id: string; timeline_entry_id: string;
  vendor_assignment_id: string | null; floor_plan_id: string | null;
  conversation_id: string | null; invoice_id: string | null;
};

/** All Related Items for every entry on an event, in one query per source type rather than one per entry — flat fetches + JS grouping, not an embedded-relationship select. */
export async function getRelatedLinksForEvent(client: DbClient, venueId: string, eventId: string): Promise<Record<string, TimelineRelatedLink[]>> {
  const { data: entryRows, error: entryError } = await client.from("timeline_entries").select("id").eq("event_id", eventId).eq("venue_id", venueId);
  if (entryError) throw entryError;
  const entryIds = (entryRows ?? []).map((r) => (r as { id: string }).id);
  if (entryIds.length === 0) return {};

  const byEntry: Record<string, TimelineRelatedLink[]> = {};

  // ---- Planning: reverse-lookup on the existing table ----
  const { data: taskLinkRows, error: taskLinkError } = await client.from("event_task_context_links")
    .select("id, event_task_id, timeline_entry_id")
    .eq("venue_id", venueId).in("timeline_entry_id", entryIds);
  if (taskLinkError) throw taskLinkError;
  const taskLinks = (taskLinkRows ?? []) as { id: string; event_task_id: string; timeline_entry_id: string }[];
  if (taskLinks.length > 0) {
    const taskIds = [...new Set(taskLinks.map((r) => r.event_task_id))];
    const { data: taskRows, error: tasksError } = await client.from("event_tasks").select("id, title").in("id", taskIds);
    if (tasksError) throw tasksError;
    const taskById = new Map((taskRows ?? []).map((t) => [(t as { id: string }).id, t as { id: string; title: string }]));
    for (const row of taskLinks) {
      const task = taskById.get(row.event_task_id);
      if (!task) continue; // task deleted out from under the link; skip rather than render a broken row
      (byEntry[row.timeline_entry_id] ??= []).push({
        id: row.id, timelineEntryId: row.timeline_entry_id, sourceType: "planning_task", sourceId: row.event_task_id,
        label: task.title, detail: null,
      });
    }
  }

  // ---- Vendor / Floor Plan / Conversation / Invoice ----
  const { data: ctxRows, error: ctxError } = await client.from("timeline_entry_context_links")
    .select("id, timeline_entry_id, vendor_assignment_id, floor_plan_id, conversation_id, invoice_id")
    .eq("venue_id", venueId).in("timeline_entry_id", entryIds);
  if (ctxError) throw ctxError;
  const rows = (ctxRows ?? []) as RelatedLinkRow[];

  const vendorAssignmentIds = rows.map((r) => r.vendor_assignment_id).filter((v): v is string => !!v);
  const floorPlanIds = rows.map((r) => r.floor_plan_id).filter((v): v is string => !!v);
  const invoiceIds = rows.map((r) => r.invoice_id).filter((v): v is string => !!v);

  const [assignmentsRes, floorPlansRes, invoicesRes] = await Promise.all([
    vendorAssignmentIds.length ? client.from("event_vendor_assignments").select("id, vendor_id").in("id", vendorAssignmentIds) : Promise.resolve({ data: [] as { id: string; vendor_id: string }[] }),
    floorPlanIds.length ? client.from("floor_plans").select("id, name").in("id", floorPlanIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    invoiceIds.length ? client.from("invoices").select("id, invoice_number, status").in("id", invoiceIds) : Promise.resolve({ data: [] as { id: string; invoice_number: string; status: string }[] }),
  ]);
  const assignments = (assignmentsRes.data ?? []) as { id: string; vendor_id: string }[];
  const vendorIds = [...new Set(assignments.map((a) => a.vendor_id))];
  const { data: vendorRows } = vendorIds.length
    ? await client.from("vendors").select("id, business_name, category").in("id", vendorIds)
    : { data: [] as { id: string; business_name: string; category: string | null }[] };

  const assignmentById = new Map(assignments.map((a) => [a.id, a]));
  const vendorById = new Map(((vendorRows ?? []) as { id: string; business_name: string; category: string | null }[]).map((v) => [v.id, v]));
  const floorPlanById = new Map((floorPlansRes.data ?? []).map((f) => [f.id, f]));
  const invoiceById = new Map((invoicesRes.data ?? []).map((i) => [i.id, i]));

  for (const row of rows) {
    let link: TimelineRelatedLink | null = null;
    if (row.vendor_assignment_id) {
      const assignment = assignmentById.get(row.vendor_assignment_id);
      const vendor = assignment ? vendorById.get(assignment.vendor_id) : undefined;
      if (vendor) link = { id: row.id, timelineEntryId: row.timeline_entry_id, sourceType: "vendor", sourceId: row.vendor_assignment_id, label: vendor.business_name, detail: vendor.category };
    } else if (row.floor_plan_id) {
      const fp = floorPlanById.get(row.floor_plan_id);
      if (fp) link = { id: row.id, timelineEntryId: row.timeline_entry_id, sourceType: "floor_plan", sourceId: row.floor_plan_id, label: fp.name, detail: null };
    } else if (row.conversation_id) {
      link = { id: row.id, timelineEntryId: row.timeline_entry_id, sourceType: "conversation", sourceId: row.conversation_id, label: "Conversation", detail: null };
    } else if (row.invoice_id) {
      const inv = invoiceById.get(row.invoice_id);
      if (inv) link = { id: row.id, timelineEntryId: row.timeline_entry_id, sourceType: "invoice", sourceId: row.invoice_id, label: `Invoice ${inv.invoice_number}`, detail: inv.status };
    }
    if (link) (byEntry[link.timelineEntryId] ??= []).push(link);
  }

  return byEntry;
}

export async function addPlanningLink(client: DbClient, venueId: string, timelineEntryId: string, taskId: string): Promise<void> {
  await playbooksRepo.addEventTaskContextLink(client, venueId, taskId, "timeline_entry", timelineEntryId);
}

export async function removePlanningLink(client: DbClient, venueId: string, linkId: string): Promise<void> {
  await playbooksRepo.removeEventTaskContextLink(client, venueId, linkId);
}

export async function addRelatedLink(
  client: DbClient, venueId: string, timelineEntryId: string,
  sourceType: Exclude<TimelineRelatedSourceType, "planning_task">, sourceId: string,
): Promise<TimelineRelatedLink> {
  const column = sourceType === "vendor" ? "vendor_assignment_id" : sourceType === "floor_plan" ? "floor_plan_id" : sourceType === "conversation" ? "conversation_id" : "invoice_id";
  const { data, error } = await client.from("timeline_entry_context_links")
    .insert({ venue_id: venueId, timeline_entry_id: timelineEntryId, [column]: sourceId })
    .select("id").single<{ id: string }>();
  if (error) throw error;

  let label = "";
  let detail: string | null = null;
  if (sourceType === "vendor") {
    const { data: assignment } = await client.from("event_vendor_assignments").select("vendor_id").eq("id", sourceId).maybeSingle<{ vendor_id: string }>();
    const { data: vendor } = assignment ? await client.from("vendors").select("business_name, category").eq("id", assignment.vendor_id).maybeSingle<{ business_name: string; category: string | null }>() : { data: null };
    label = vendor?.business_name ?? "Vendor";
    detail = vendor?.category ?? null;
  } else if (sourceType === "floor_plan") {
    const { data: fp } = await client.from("floor_plans").select("name").eq("id", sourceId).maybeSingle<{ name: string }>();
    label = fp?.name ?? "Floor Plan";
  } else if (sourceType === "conversation") {
    label = "Conversation";
  } else {
    const { data: inv } = await client.from("invoices").select("invoice_number, status").eq("id", sourceId).maybeSingle<{ invoice_number: string; status: string }>();
    label = inv ? `Invoice ${inv.invoice_number}` : "Invoice";
    detail = inv?.status ?? null;
  }

  return { id: data.id, timelineEntryId, sourceType, sourceId, label, detail };
}

export async function removeRelatedLink(client: DbClient, venueId: string, linkId: string): Promise<void> {
  const { error } = await client.from("timeline_entry_context_links").delete().eq("id", linkId).eq("venue_id", venueId);
  if (error) throw error;
}

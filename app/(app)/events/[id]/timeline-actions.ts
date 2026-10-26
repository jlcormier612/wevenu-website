"use server";

import { revalidatePath } from "next/cache";

import {
  addEntry,
  addEntryAttachment,
  addEntryLink,
  addPlanningLink,
  addRelatedLink,
  addSection,
  applyTemplate,
  deleteEntry,
  deleteSection,
  duplicateSection,
  removeEntryAttachment,
  removeEntryLink,
  removePlanningLink,
  removeRelatedLink,
  renameSection,
  reorderEntries,
  reorderEntry,
  reorderSections,
  saveEventTimelineDraft,
  setSectionClientCanAdd,
  shareClientTimelineWithCouple,
  shareTimelineWithCouple,
  shiftEntriesAfter,
  updateEntry,
} from "@/lib/timeline/service";
import type {
  AddAttachmentResult,
  AddEntryResult,
  AddLinkResult,
  AddRelatedLinkResult,
  AddSectionResult,
  DuplicateSectionResult,
  TimelineActionResult,
  TimelineDraftBatchInput,
  TimelineDraftBatchResult,
  TimelineEntryInput,
  TimelineRelatedSourceType,
} from "@/lib/timeline/types";
import type { ShareTimelineWithCoupleResult } from "@/lib/timeline/service";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  // Day-of Sheet + Timeline print are separate RSC routes — parent
  // revalidatePath does not invalidate them. Without these, deletes/edits
  // leave a stale preview until a hard redeploy or unrelated mutation.
  revalidatePath(`/events/${eventId}/day-sheet`);
  revalidatePath(`/events/${eventId}/timeline-print`);
}

/**
 * Venue Publish-to-Vendors is live in timeline_entries, but vendor event
 * pages were only revalidated from vendor-side actions. Prefetched / open
 * RSC payloads could keep an empty Timeline after the venue tagged Vendors.
 * Bust assigned vendors' event routes (and Home) so the Timeline tab updates.
 */
async function revalidateVendorEventTimelines(eventId: string) {
  try {
    const { createClient } = await import("@/integrations/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_vendor_assignments")
      .select("id")
      .eq("event_id", eventId);
    for (const row of data ?? []) {
      revalidatePath(`/vendor/events/${row.id as string}`);
    }
    revalidatePath("/vendor/dashboard");
    revalidatePath("/vendor/events");
  } catch {
    // Non-blocking — venue save already succeeded.
  }
}

async function revalidateClientWorkspace(eventId: string) {
  try {
    const { createClient } = await import("@/integrations/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("client_id")
      .eq("id", eventId)
      .maybeSingle<{ client_id: string | null }>();
    if (data?.client_id) revalidatePath(`/clients/${data.client_id}`);
  } catch {
    // Non-blocking.
  }
}

async function revalidateTimelineSurfaces(eventId: string) {
  revalidateEvent(eventId);
  await revalidateClientWorkspace(eventId);
  await revalidateVendorEventTimelines(eventId);
}

// Corrected on review: this is NOT a §8 violation. addEntryAction only
// ever creates owner='venue' rows (the client's own items are created
// exclusively through the portal RPCs) — the coordinator is both
// Workspace Owner and Operational Owner for their own entries, the same
// shape as Event Order's Finalize, so there's no cross-party commitment
// being fired on early. "Build timeline" (a required coordinator-only
// stock task) genuinely depends on this firing when the coordinator adds
// their own entries — retiring it would have silently broken that task.
async function triggerTimelineAutoComplete(eventId: string) {
  try {
    const { createClient } = await import("@/integrations/supabase/server");
    const { getCurrentVenue } = await import("@/lib/venue/service");
    const { triggerAutoComplete } = await import("@/lib/playbooks/service");
    const [sb, venue] = await Promise.all([createClient(), getCurrentVenue()]);
    if (venue) await triggerAutoComplete(sb, venue.id, eventId, "timeline_created");
  } catch { /* non-blocking */ }
}

export async function addEntryAction(
  eventId: string, input: TimelineEntryInput,
): Promise<AddEntryResult> {
  const result = await addEntry(eventId, input);
  if (result.ok) {
    await revalidateTimelineSurfaces(eventId);
    void triggerTimelineAutoComplete(eventId);
  }
  return result;
}

export async function updateEntryAction(
  entryId: string, eventId: string, input: TimelineEntryInput,
): Promise<TimelineActionResult> {
  const result = await updateEntry(entryId, input);
  if (result.ok) await revalidateTimelineSurfaces(eventId);
  return result;
}

export async function deleteEntryAction(
  entryId: string, eventId: string,
): Promise<TimelineActionResult> {
  const result = await deleteEntry(entryId);
  if (result.ok) await revalidateTimelineSurfaces(eventId);
  return result;
}

/**
 * Event Timeline setup editor — apply deletes + upserts in one action
 * (single revalidate). Does not touch Library templates or other events.
 */
export async function saveEventTimelineDraftAction(
  eventId: string,
  draft: TimelineDraftBatchInput,
): Promise<TimelineDraftBatchResult> {
  const result = await saveEventTimelineDraft(eventId, draft);
  if (result.ok && (result.deleted > 0 || result.updated > 0 || result.created > 0)) {
    await revalidateTimelineSurfaces(eventId);
    void triggerTimelineAutoComplete(eventId);
  }
  return result;
}

export async function shiftEntriesAfterAction(
  eventId: string, afterEntryId: string, minutesDelta: number,
): Promise<TimelineActionResult & { shiftedCount?: number }> {
  const result = await shiftEntriesAfter(eventId, afterEntryId, minutesDelta);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reorderEntryAction(
  eventId: string, entryId: string, direction: "up" | "down",
): Promise<TimelineActionResult> {
  const result = await reorderEntry(eventId, entryId, direction);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reorderEntriesAction(
  eventId: string, updates: { id: string; sectionId: string | null; sortOrder: number; dayOffset?: number }[],
): Promise<TimelineActionResult> {
  const result = await reorderEntries(updates);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function applyTemplateAction(
  eventId: string, templateId: string, eventStartTime: string | null,
): Promise<TimelineActionResult> {
  const result = await applyTemplate(eventId, templateId, eventStartTime);
  if (result.ok) await revalidateTimelineSurfaces(eventId);
  return result;
}

/** Overview setup editor — replace venue-owned timeline from a Library template (no share). */
export async function replaceEventTimelineFromTemplateAction(
  eventId: string,
  templateId: string,
  eventStartTime: string | null,
): Promise<TimelineActionResult> {
  try {
    const { replaceEventTimelineFromTemplate } = await import("@/lib/timeline-templates/apply");
    const result = await replaceEventTimelineFromTemplate(eventId, templateId, eventStartTime);
    if (result.ok) await revalidateTimelineSurfaces(eventId);
    return result;
  } catch (err) {
    console.error("replaceEventTimelineFromTemplateAction failed:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not switch the timeline template.",
    };
  }
}

/** P1b: release venue working timeline to the couple (immutable snapshot). No email. */
export async function shareTimelineWithCoupleAction(
  eventId: string,
): Promise<ShareTimelineWithCoupleResult> {
  const result = await shareTimelineWithCouple(eventId);
  if (result.ok) await revalidateTimelineSurfaces(eventId);
  return result;
}

export async function previewVenueTimelineReleaseAction(eventId: string) {
  const { previewVenueTimelineRelease } = await import("@/lib/timeline/release-service");
  return previewVenueTimelineRelease(eventId);
}

export async function confirmVenueTimelineReleaseAction(
  eventId: string,
  input: {
    acknowledgedHoldOutIds: string[];
    workingFingerprint: string;
    idempotencyKey?: string | null;
  },
) {
  const { confirmVenueTimelineRelease } = await import("@/lib/timeline/release-service");
  const result = await confirmVenueTimelineRelease(eventId, input);
  if (result.ok) await revalidateTimelineSurfaces(eventId);
  return result;
}

export async function shareClientTimelineWithCoupleAction(
  clientId: string,
): Promise<ShareTimelineWithCoupleResult> {
  const result = await shareClientTimelineWithCouple(clientId);
  if (result.ok) {
    revalidatePath(`/clients/${clientId}`);
  }
  return result;
}

// ---- Sections ------------------------------------------------------------------

export async function addSectionAction(eventId: string, name: string, sortOrder: number): Promise<AddSectionResult> {
  const result = await addSection(eventId, name, sortOrder);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function renameSectionAction(sectionId: string, eventId: string, name: string): Promise<TimelineActionResult> {
  const result = await renameSection(sectionId, name);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function deleteSectionAction(sectionId: string, eventId: string): Promise<TimelineActionResult> {
  const result = await deleteSection(sectionId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reorderSectionsAction(eventId: string, orderedSectionIds: string[]): Promise<TimelineActionResult> {
  const result = await reorderSections(orderedSectionIds);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function duplicateSectionAction(eventId: string, sourceSectionId: string, sortOrder: number): Promise<DuplicateSectionResult> {
  const result = await duplicateSection(eventId, sourceSectionId, sortOrder);
  if (result.ok) await revalidateTimelineSurfaces(eventId);
  return result;
}

export async function setSectionClientCanAddAction(sectionId: string, eventId: string, clientCanAdd: boolean): Promise<TimelineActionResult> {
  const result = await setSectionClientCanAdd(sectionId, clientCanAdd);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

// ---- Links -----------------------------------------------------------------

export async function addEntryLinkAction(timelineEntryId: string, eventId: string, url: string, label: string | null, sortOrder: number): Promise<AddLinkResult> {
  const result = await addEntryLink(timelineEntryId, url, label, sortOrder);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removeEntryLinkAction(linkId: string, eventId: string): Promise<TimelineActionResult> {
  const result = await removeEntryLink(linkId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

// ---- Attachments -----------------------------------------------------------

export async function addEntryAttachmentAction(timelineEntryId: string, eventId: string, documentId: string, sortOrder: number): Promise<AddAttachmentResult> {
  const result = await addEntryAttachment(timelineEntryId, documentId, sortOrder);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removeEntryAttachmentAction(attachmentId: string, eventId: string): Promise<TimelineActionResult> {
  const result = await removeEntryAttachment(attachmentId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

// ---- Related Items (Planning, Vendors, Floor Plans, Conversation, Invoices) --

export async function addPlanningLinkAction(timelineEntryId: string, eventId: string, taskId: string): Promise<TimelineActionResult> {
  const result = await addPlanningLink(timelineEntryId, taskId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removePlanningLinkAction(linkId: string, eventId: string): Promise<TimelineActionResult> {
  const result = await removePlanningLink(linkId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function addRelatedLinkAction(
  timelineEntryId: string, eventId: string, sourceType: Exclude<TimelineRelatedSourceType, "planning_task">, sourceId: string,
): Promise<AddRelatedLinkResult> {
  const result = await addRelatedLink(timelineEntryId, sourceType, sourceId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removeRelatedLinkAction(linkId: string, eventId: string): Promise<TimelineActionResult> {
  const result = await removeRelatedLink(linkId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

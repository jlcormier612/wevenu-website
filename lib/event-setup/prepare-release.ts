/**
 * Prepare and release portal — one venue action after optional event edits.
 *
 * Ensures applicable event-level drafts exist, releases client-facing planning,
 * and shares the timeline when present. Does NOT invite, send questionnaires,
 * create invoices, or share inventory/Event Order (those stay draft until
 * separately shared).
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { eventSetupFromColumns } from "@/lib/event-setup/profile";
import { parseTemplateRefs } from "@/lib/event-setup/template-refs";
import { effectiveSetupDecision } from "@/lib/event-setup/state";

export type PrepareReleaseResult =
  | { ok: true; message: string; releasedPlanning: boolean; sharedTimeline: boolean }
  | { ok: false; message: string };

export async function prepareAndReleasePortal(
  eventId: string,
  clientId: string,
  coupleName: string,
): Promise<PrepareReleaseResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, event_date, venue_id")
    .eq("id", eventId)
    .eq("venue_id", venue.id)
    .maybeSingle<{ id: string; event_date: string | null; venue_id: string }>();
  if (eventError || !event) return { ok: false, message: "Event not found." };

  const { data: setupRow } = await supabase
    .from("event_setup_states")
    .select("*")
    .eq("event_id", eventId)
    .eq("venue_id", venue.id)
    .maybeSingle();
  const setup = setupRow ? eventSetupFromColumns(setupRow as never) : null;
  const refs = parseTemplateRefs(setup?.inheritedTemplateRefs ?? {});

  // Ensure Inventory / Event Order drafts when Included with a template.
  const inventoryDecision = setup ? effectiveSetupDecision(setup, "inventory") : null;
  const eventOrderDecision = setup ? effectiveSetupDecision(setup, "event_order") : null;

  if (inventoryDecision === "set_up" && refs.inventoryTemplateId) {
    try {
      const { ensureEventInventory } = await import("@/lib/event-inventory/service");
      const ensured = await ensureEventInventory(eventId, refs.inventoryTemplateId);
      if (!ensured.ok) {
        return { ok: false, message: ensured.message ?? "Could not prepare inventory draft." };
      }
    } catch (err) {
      console.error("prepareAndReleasePortal inventory failed:", err);
      return { ok: false, message: "Could not prepare inventory draft." };
    }
  }

  if (eventOrderDecision === "set_up" && refs.eventOrderTemplateId) {
    try {
      const { ensureEventOrder } = await import("@/lib/event-orders/service");
      const ensured = await ensureEventOrder(eventId, refs.eventOrderTemplateId);
      if (!ensured.ok) {
        return { ok: false, message: ensured.message ?? "Could not prepare Event Order draft." };
      }
    } catch (err) {
      console.error("prepareAndReleasePortal event order failed:", err);
      return { ok: false, message: "Could not prepare Event Order draft." };
    }
  }

  // Release client planning when a draft exists (idempotent if already released).
  let releasedPlanning = false;
  const { data: clientApp } = await supabase
    .from("event_playbook_applications")
    .select("id, released_at, kind")
    .eq("event_id", eventId)
    .eq("venue_id", venue.id)
    .eq("kind", "client")
    .maybeSingle<{ id: string; released_at: string | null; kind: string }>();

  if (clientApp && !clientApp.released_at) {
    const { releasePlaybookApplication } = await import("@/lib/playbooks/service");
    const released = await releasePlaybookApplication(eventId, clientId, coupleName);
    if (!released.ok) {
      return { ok: false, message: released.message ?? "Could not release Client Planning." };
    }
    releasedPlanning = true;
  } else if (clientApp?.released_at) {
    releasedPlanning = true;
  } else if (refs.planningPlaybookTemplateId && event.event_date) {
    // Apply then release if profile had a checklist but booking somehow skipped it.
    const { applyPlaybookToEvent, releasePlaybookApplication } = await import("@/lib/playbooks/service");
    const applied = await applyPlaybookToEvent(eventId, refs.planningPlaybookTemplateId, event.event_date);
    if (!applied.ok && !/already has/i.test(applied.message ?? "")) {
      return { ok: false, message: applied.message ?? "Could not apply Client Planning." };
    }
    const released = await releasePlaybookApplication(eventId, clientId, coupleName);
    if (!released.ok) {
      return { ok: false, message: released.message ?? "Could not release Client Planning." };
    }
    releasedPlanning = true;
  }

  // Ensure portal session exists even when planning was already released.
  try {
    const { getPortalSessions, createPortalSession } = await import("@/lib/portal/service");
    const sessions = await getPortalSessions(clientId);
    if (sessions.length === 0) await createPortalSession(clientId, coupleName);
  } catch (err) {
    console.error("prepareAndReleasePortal portal session failed:", err);
  }

  // Share timeline with the couple when entries exist (idempotent share).
  let sharedTimeline = false;
  const timelineDecision = setup ? effectiveSetupDecision(setup, "timeline") : null;
  if (timelineDecision !== "skipped") {
    const { data: entries } = await supabase
      .from("timeline_entries")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);
    if (entries && entries.length > 0) {
      try {
        const { shareTimelineWithCouple } = await import("@/lib/timeline/service");
        const shared = await shareTimelineWithCouple(eventId);
        if (shared.ok === false) {
          // Non-fatal if already shared or unavailable — continue.
          console.error("prepareAndReleasePortal timeline share:", shared.message);
        } else {
          sharedTimeline = true;
        }
      } catch (err) {
        console.error("prepareAndReleasePortal timeline share failed:", err);
      }
    }
  }

  // Persist a prepare stamp on setup state when the column exists; ignore if absent.
  try {
    await supabase
      .from("event_setup_states")
      .update({
        collapsed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId)
      .eq("venue_id", venue.id);
  } catch {
    /* non-blocking */
  }

  return {
    ok: true,
    releasedPlanning,
    sharedTimeline,
    message:
      "Portal content is prepared and released for this event. Questionnaires stay on their own schedule. Invite the client separately when you are ready — this did not send an invitation.",
  };
}

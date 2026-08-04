/**
 * System-Required Lifecycle Behavior — Venue Lifecycle Automation
 * Completion Pass (2026-08-04), Phase 2/3.
 *
 * Distinct from lib/automation/actions.ts's Automation Rule actions:
 * everything in this file runs unconditionally, every sweep, independent
 * of whether any automation_rules row exists or is enabled. A venue owner
 * must never need to discover Settings > Automation Rules for behavior in
 * this file to happen — see docs/venue-lifecycle-automation-completion-
 * report.md Phase 2 for the full system-required/venue-configurable
 * boundary this file is one side of.
 *
 * Currently one guarantee: apply each of the venue's own default playbook
 * templates (client-kind and venue-kind independently — an event can have
 * one of each, per event_playbook_applications' own (event_id, kind)
 * primary key) to a newly-confirmed booking, exactly once. Reuses
 * applyPlaybookToEvent() exactly — the same function a coordinator's own
 * manual "Apply Playbook" click already calls, never a re-implementation
 * — and that same primary key as the only idempotency guard, per this
 * pass's explicit instruction not to invent a second, competing truth.
 * A venue with no default template configured for an event's event_type
 * is untouched — this guarantees the *default applies when one exists*,
 * it does not force every venue to have one (see Phase 10).
 */
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

import { applyPlaybookToEvent } from "@/lib/playbooks/repository";

const BATCH_SIZE = 50;

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type SystemGuaranteeResult = { applied: number; skipped: number; failed: number };

type BookingEventRow = { id: string; entity_id: string; venue_id: string };
type EventRow = { event_type: string | null; event_date: string };
type DefaultTemplateRow = { id: string; kind: string };

/**
 * Scans Booking.Confirmed Platform Events (not just newly-created ones —
 * re-scanning is intentionally cheap and safe: applyPlaybookToEvent's own
 * (event_id, kind) guard makes every already-applied row a fast no-op, so
 * this never needs its own separate "have I seen this platform event
 * before" ledger). Batch-limited the same way the Automation Rule engine
 * itself is, for the same reason — this is designed to run every sweep,
 * forever, not once.
 */
export async function applyDefaultPlaybooksForConfirmedBookings(): Promise<SystemGuaranteeResult> {
  const result: SystemGuaranteeResult = { applied: 0, skipped: 0, failed: 0 };
  const client = getServiceClient();
  if (!client) return result;

  const { data: events } = await client
    .from("platform_events")
    .select("id, entity_id, venue_id")
    .eq("event_type", "Booking.Confirmed")
    .order("occurred_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (!events || events.length === 0) return result;

  for (const row of events as BookingEventRow[]) {
    try {
      const { data: eventRow } = await client
        .from("events")
        .select("event_type, event_date")
        .eq("id", row.entity_id)
        .maybeSingle<EventRow>();
      if (!eventRow) { result.skipped++; continue; }

      const { data: defaults } = await client
        .from("playbook_templates")
        .select("id, kind")
        .eq("venue_id", row.venue_id)
        .eq("event_type", eventRow.event_type)
        .eq("is_default", true)
        .eq("is_archived", false);

      if (!defaults || defaults.length === 0) { result.skipped++; continue; }

      for (const tpl of defaults as DefaultTemplateRow[]) {
        const applied = await applyPlaybookToEvent(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client as any,
          row.venue_id, row.entity_id, tpl.id, eventRow.event_date,
        );
        // "already_applied" is the expected, correct outcome on a replay
        // (idempotency working as designed) — not a failure.
        if (applied.ok) result.applied++;
        else result.skipped++;
      }
    } catch (e) {
      result.failed++;
      console.error("[automation] default playbook application failed:", e instanceof Error ? e.message : e);
    }
  }

  return result;
}

/**
 * Load authoritative relationship lifecycle facts for a lead (venue-scoped).
 * Read-only — does not mutate booking, contract, or payment records.
 */

import type { createClient } from "@/integrations/supabase/server";
import type { RelationshipLifecycleFacts } from "@/lib/luv/relationship-lifecycle-eligibility";

type DbClient = Awaited<ReturnType<typeof createClient>>;

function isEventDatePast(eventDate: string | null | undefined, nowMs: number): boolean {
  if (!eventDate) return false;
  // Date-only (YYYY-MM-DD) or timestamp — compare calendar day in UTC.
  const day = eventDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const endOfEventDay = Date.parse(`${day}T23:59:59.999Z`);
  return Number.isFinite(endOfEventDay) && endOfEventDay < nowMs;
}

/**
 * Batch-friendly facts for one lead. Uses the same commercial evidence
 * sources as dashboard tour-follow-up supersession.
 */
export async function loadRelationshipLifecycleFacts(
  supabase: DbClient,
  venueId: string,
  leadId: string,
  options?: { nowMs?: number },
): Promise<RelationshipLifecycleFacts> {
  const nowMs = options?.nowMs ?? Date.now();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, first_booked_at, lost_at, status, sales_stage")
    .eq("venue_id", venueId)
    .eq("id", leadId)
    .maybeSingle<{
      id: string;
      first_booked_at: string | null;
      lost_at: string | null;
      status: string | null;
      sales_stage: string | null;
    }>();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, lead_id, status, lifecycle_booked_at, event_date")
    .eq("venue_id", venueId)
    .eq("lead_id", leadId);

  const clientRows = (clients ?? []) as {
    id: string;
    lead_id: string | null;
    status: string | null;
    lifecycle_booked_at: string | null;
    event_date: string | null;
  }[];
  const clientIds = clientRows.map((c) => c.id);

  let contractSigned = false;
  let paymentReceived = false;
  let bookingCancelled = false;
  let clientLifecycleBookedAt: string | null = null;
  let eventDatePast = false;

  for (const c of clientRows) {
    if (c.lifecycle_booked_at && !clientLifecycleBookedAt) {
      clientLifecycleBookedAt = c.lifecycle_booked_at;
    }
    if (isEventDatePast(c.event_date, nowMs)) eventDatePast = true;
    const st = (c.status ?? "").toLowerCase();
    if (st === "cancelled" || st === "canceled") bookingCancelled = true;
  }

  if (clientIds.length > 0) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, client_id, status, contract_signers(signer_type, signed_at)")
      .eq("venue_id", venueId)
      .in("client_id", clientIds)
      .in("status", ["sent", "signed"]);
    for (const row of (contracts ?? []) as {
      client_id: string | null;
      status: string;
      contract_signers:
        | { signer_type: string; signed_at: string | null }[]
        | { signer_type: string; signed_at: string | null }
        | null;
    }[]) {
      if (!row.client_id) continue;
      const signers = Array.isArray(row.contract_signers)
        ? row.contract_signers
        : row.contract_signers
          ? [row.contract_signers]
          : [];
      const clientSigned = signers.some((s) => s.signer_type === "client" && s.signed_at != null);
      if (row.status === "signed" || clientSigned) contractSigned = true;
    }

    const { data: schedules } = await supabase
      .from("payment_schedules")
      .select("client_id, payment_line_items(status)")
      .eq("venue_id", venueId)
      .in("client_id", clientIds);
    for (const row of (schedules ?? []) as {
      client_id: string | null;
      payment_line_items: { status: string }[] | { status: string } | null;
    }[]) {
      if (!row.client_id) continue;
      const lines = Array.isArray(row.payment_line_items)
        ? row.payment_line_items
        : row.payment_line_items
          ? [row.payment_line_items]
          : [];
      if (lines.some((l) => l.status === "paid")) paymentReceived = true;
    }
  }

  return {
    firstBookedAt: lead?.first_booked_at ?? null,
    clientLifecycleBookedAt,
    lostAt: lead?.lost_at ?? null,
    leadStatus: lead?.status ?? null,
    salesStage: lead?.sales_stage ?? null,
    contractSigned,
    paymentReceived,
    eventDatePast,
    bookingCancelled,
    // Consent is rechecked on channel send paths; default OK for draft eligibility
    // unless a caller supplies channelConsentOk: false.
    channelConsentOk: true,
  };
}

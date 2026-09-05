/**
 * Deterministic financial → frozen acquisition source resolution.
 *
 * Chain (when present):
 *   invoice / payment schedule → event (optional) → client → lead → acquisition_source
 *
 * Schema fact: clients.lead_id is unique (one originating lead per client).
 * All events under that client share the same frozen acquisition_source, so
 * multi-event does NOT make acquisition source ambiguous.
 *
 * Unknown when:
 *   - no resolvable client
 *   - client has no lead_id (Direct/Import leadless)
 *   - lead.acquisition_source is null
 *   - invoice.event_id points at an event whose client_id disagrees with invoice.client_id
 *
 * Does not invent Organic/Direct. Does not use mutable leads.source.
 */
import type { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Client → frozen acquisition_source via originating lead.
 * Multi-event clients with a lead remain attributed (same source for all events).
 */
export async function resolveDeterministicClientAcquisitionSource(
  supabase: DbClient,
  venueId: string,
  clientIds: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (clientIds.length === 0) return result;

  const { data: clients } = await supabase
    .from("clients")
    .select("id, lead_id, leads(acquisition_source)")
    .eq("venue_id", venueId)
    .in("id", clientIds);

  type ClientRow = {
    id: string;
    lead_id: string | null;
    leads: { acquisition_source: string | null } | null;
  };
  for (const c of (clients ?? []) as unknown as ClientRow[]) {
    if (!c.lead_id) {
      result.set(c.id, null);
      continue;
    }
    result.set(c.id, c.leads?.acquisition_source ?? null);
  }
  for (const id of clientIds) {
    if (!result.has(id)) result.set(id, null);
  }
  return result;
}

export type FinancialAttributionInput = {
  /** Invoice or payment-schedule row id (for result map key). */
  id: string;
  clientId: string | null;
  eventId: string | null;
};

/**
 * Prefer event→client→lead when event_id is set; else client→lead.
 * Returns map of input.id → frozen acquisition_source (null = Unknown).
 */
export async function resolveDeterministicFinancialAcquisitionSource(
  supabase: DbClient,
  venueId: string,
  rows: FinancialAttributionInput[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (rows.length === 0) return out;

  const eventIds = [...new Set(rows.map((r) => r.eventId).filter((v): v is string => !!v))];
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((v): v is string => !!v))];

  const [{ data: events }, sourceByClient] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, client_id").eq("venue_id", venueId).in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; client_id: string | null }[] }),
    resolveDeterministicClientAcquisitionSource(supabase, venueId, clientIds),
  ]);

  const eventClient = new Map(
    ((events ?? []) as { id: string; client_id: string | null }[]).map((e) => [e.id, e.client_id]),
  );

  // Also resolve clients discovered only via event.client_id
  const extraClientIds = [...eventClient.values()].filter(
    (id): id is string => !!id && !sourceByClient.has(id),
  );
  if (extraClientIds.length > 0) {
    const extra = await resolveDeterministicClientAcquisitionSource(supabase, venueId, extraClientIds);
    for (const [k, v] of extra) sourceByClient.set(k, v);
  }

  for (const row of rows) {
    let clientId = row.clientId;
    if (row.eventId) {
      const fromEvent = eventClient.get(row.eventId) ?? null;
      if (fromEvent && row.clientId && fromEvent !== row.clientId) {
        out.set(row.id, null);
        continue;
      }
      clientId = fromEvent ?? row.clientId;
    }
    if (!clientId) {
      out.set(row.id, null);
      continue;
    }
    out.set(row.id, sourceByClient.get(clientId) ?? null);
  }
  return out;
}

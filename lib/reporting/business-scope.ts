/**
 * Customer-facing Reporting scope: records with
 * exclude_from_business_reporting = false.
 */

export const EXCLUDE_FROM_BUSINESS_REPORTING = "exclude_from_business_reporting";

/** Apply the customer-facing reporting flag without threading PostgREST builder generics. */
export function onlyBusinessReporting<T>(query: T): T {
  return (query as { eq: (column: string, value: boolean) => T }).eq(
    EXCLUDE_FROM_BUSINESS_REPORTING,
    false,
  );
}

export type ReportingExclusionSets = {
  leadIds: Set<string>;
  clientIds: Set<string>;
  eventIds: Set<string>;
};

export async function loadReportingExclusions(
  supabase: { from: (table: string) => unknown },
  venueId: string,
): Promise<ReportingExclusionSets> {
  const db = supabase as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string | boolean) => {
          eq: (col: string, val: string | boolean) => Promise<{ data: { id: string }[] | null }>;
        };
      };
    };
  };
  const [{ data: leads }, { data: clients }, { data: events }] = await Promise.all([
    db.from("leads").select("id").eq("venue_id", venueId).eq(EXCLUDE_FROM_BUSINESS_REPORTING, true),
    db.from("clients").select("id").eq("venue_id", venueId).eq(EXCLUDE_FROM_BUSINESS_REPORTING, true),
    db.from("events").select("id").eq("venue_id", venueId).eq(EXCLUDE_FROM_BUSINESS_REPORTING, true),
  ]);
  return {
    leadIds: new Set((leads ?? []).map((r) => r.id)),
    clientIds: new Set((clients ?? []).map((r) => r.id)),
    eventIds: new Set((events ?? []).map((r) => r.id)),
  };
}

export function isExcludedFromBusinessReporting(
  exclusions: ReportingExclusionSets,
  ids: { leadId?: string | null; clientId?: string | null; eventId?: string | null },
): boolean {
  if (ids.leadId && exclusions.leadIds.has(ids.leadId)) return true;
  if (ids.clientId && exclusions.clientIds.has(ids.clientId)) return true;
  if (ids.eventId && exclusions.eventIds.has(ids.eventId)) return true;
  return false;
}

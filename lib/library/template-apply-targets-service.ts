/**
 * Server load for Use Template client-first pickers.
 * Venue-scoped; excludes cancelled events; does not delete QA data.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  formatClientDisplayName,
  groupTemplateApplyTargets,
  type TemplateApplyClientGroup,
  type TemplateApplyEventTarget,
} from "@/lib/library/template-apply-targets";

type ClientEmbed = {
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  status: string;
};

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  status: string;
  client_id: string | null;
  clients: ClientEmbed | ClientEmbed[] | null;
};

function unwrapClient(clients: EventRow["clients"]): ClientEmbed | null {
  if (!clients) return null;
  return Array.isArray(clients) ? clients[0] ?? null : clients;
}

export async function getTemplateApplyClientGroups(): Promise<TemplateApplyClientGroup[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, name, event_date, status, client_id, clients(first_name, last_name, partner_first_name, partner_last_name, status)",
    )
    .eq("venue_id", venue.id)
    .neq("status", "cancelled")
    .order("event_date", { ascending: true });
  if (error) throw error;

  const targets: TemplateApplyEventTarget[] = [];
  for (const row of (data ?? []) as unknown as EventRow[]) {
    const client = unwrapClient(row.clients);
    if (!row.client_id || !client) continue;
    if (client.status === "cancelled") continue;
    targets.push({
      id: row.id,
      name: row.name,
      eventDate: row.event_date,
      status: row.status,
      clientId: row.client_id,
      clientDisplayName: formatClientDisplayName({
        firstName: client.first_name,
        lastName: client.last_name,
        partnerFirstName: client.partner_first_name,
        partnerLastName: client.partner_last_name,
      }),
    });
  }
  return groupTemplateApplyTargets(targets);
}

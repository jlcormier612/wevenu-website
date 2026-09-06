import type {
  CommercialSelection,
  CommercialSelectionItem,
  CommercialSelectionStatus,
  CreateCommercialSelectionInput,
} from "@/lib/commercial-selections/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = {
  id: string;
  venue_id: string;
  lead_id: string | null;
  client_id: string | null;
  event_id: string | null;
  source_package_id: string | null;
  name: string;
  total_amount: number | string;
  deposit_amount: number | string;
  included_items: CommercialSelectionItem[] | null;
  status: CommercialSelectionStatus;
  version: number;
  superseded_by_id: string | null;
  offered_at: string | null;
  accepted_at: string | null;
  accept_token: string | null;
  offer_message: string | null;
  invoice_id: string | null;
  contract_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(r: Row): CommercialSelection {
  return {
    id: r.id,
    venueId: r.venue_id,
    leadId: r.lead_id,
    clientId: r.client_id,
    eventId: r.event_id,
    sourcePackageId: r.source_package_id,
    name: r.name,
    totalAmount: Number(r.total_amount),
    depositAmount: Number(r.deposit_amount),
    includedItems: Array.isArray(r.included_items) ? r.included_items : [],
    status: r.status,
    version: r.version,
    supersededById: r.superseded_by_id,
    offeredAt: r.offered_at,
    acceptedAt: r.accepted_at,
    acceptToken: r.accept_token,
    offerMessage: r.offer_message,
    invoiceId: r.invoice_id,
    contractId: r.contract_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT = "*";

export async function insertSelection(
  client: SupabaseClient,
  venueId: string,
  input: CreateCommercialSelectionInput,
): Promise<CommercialSelection> {
  const { data, error } = await client
    .from("commercial_selections")
    .insert({
      venue_id: venueId,
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      event_id: input.eventId ?? null,
      source_package_id: input.sourcePackageId || null,
      name: input.name.trim(),
      total_amount: input.totalAmount,
      deposit_amount: input.depositAmount,
      included_items: input.includedItems,
      status: "draft",
      version: 1,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return mapRow(data as Row);
}

export async function getSelection(
  client: SupabaseClient,
  venueId: string,
  id: string,
): Promise<CommercialSelection | null> {
  const { data, error } = await client
    .from("commercial_selections")
    .select(SELECT)
    .eq("venue_id", venueId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

/** Active (non-superseded) selection for a lead, newest first. */
export async function getActiveSelectionForLead(
  client: SupabaseClient,
  venueId: string,
  leadId: string,
): Promise<CommercialSelection | null> {
  const { data, error } = await client
    .from("commercial_selections")
    .select(SELECT)
    .eq("venue_id", venueId)
    .eq("lead_id", leadId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function getActiveSelectionForClient(
  client: SupabaseClient,
  venueId: string,
  clientId: string,
): Promise<CommercialSelection | null> {
  const { data, error } = await client
    .from("commercial_selections")
    .select(SELECT)
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function getActiveSelectionForEvent(
  client: SupabaseClient,
  venueId: string,
  eventId: string,
): Promise<CommercialSelection | null> {
  const { data, error } = await client
    .from("commercial_selections")
    .select(SELECT)
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function supersedeSelection(
  client: SupabaseClient,
  venueId: string,
  previousId: string,
  replacement: CommercialSelection,
): Promise<void> {
  const { error } = await client
    .from("commercial_selections")
    .update({ status: "superseded", superseded_by_id: replacement.id })
    .eq("venue_id", venueId)
    .eq("id", previousId)
    .neq("status", "superseded");
  if (error) throw error;
}

export async function updateSelectionLinks(
  client: SupabaseClient,
  venueId: string,
  id: string,
  links: {
    leadId?: string | null;
    clientId?: string | null;
    eventId?: string | null;
    invoiceId?: string | null;
    contractId?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (links.leadId !== undefined) patch.lead_id = links.leadId;
  if (links.clientId !== undefined) patch.client_id = links.clientId;
  if (links.eventId !== undefined) patch.event_id = links.eventId;
  if (links.invoiceId !== undefined) patch.invoice_id = links.invoiceId;
  if (links.contractId !== undefined) patch.contract_id = links.contractId;
  if (Object.keys(patch).length === 0) return;
  const { error } = await client
    .from("commercial_selections")
    .update(patch)
    .eq("venue_id", venueId)
    .eq("id", id);
  if (error) throw error;
}

export async function markOffered(
  client: SupabaseClient,
  venueId: string,
  id: string,
  acceptToken: string,
  offerMessage: string | null,
): Promise<CommercialSelection | null> {
  const { data, error } = await client
    .from("commercial_selections")
    .update({
      status: "offered",
      offered_at: new Date().toISOString(),
      accept_token: acceptToken,
      offer_message: offerMessage,
    })
    .eq("venue_id", venueId)
    .eq("id", id)
    .in("status", ["draft", "offered"])
    .select(SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function markAcceptedVenue(
  client: SupabaseClient,
  venueId: string,
  id: string,
): Promise<CommercialSelection | null> {
  const { data, error } = await client
    .from("commercial_selections")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("venue_id", venueId)
    .eq("id", id)
    .in("status", ["draft", "offered"])
    .select(SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function bumpVersion(
  client: SupabaseClient,
  venueId: string,
  input: CreateCommercialSelectionInput & { version: number },
): Promise<CommercialSelection> {
  const { data, error } = await client
    .from("commercial_selections")
    .insert({
      venue_id: venueId,
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      event_id: input.eventId ?? null,
      source_package_id: input.sourcePackageId || null,
      name: input.name.trim(),
      total_amount: input.totalAmount,
      deposit_amount: input.depositAmount,
      included_items: input.includedItems,
      status: "draft",
      version: input.version,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return mapRow(data as Row);
}

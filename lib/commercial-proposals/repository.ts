import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CommercialProposal,
  CommercialProposalChoice,
  CommercialProposalOption,
  CommercialProposalStatus,
  ProposalOptionItem,
} from "@/lib/commercial-proposals/types";
import type { PackageOfferRole } from "@/lib/packages/eligibility";

type ProposalRow = {
  id: string;
  venue_id: string;
  lead_id: string | null;
  client_id: string | null;
  event_id: string | null;
  status: CommercialProposalStatus;
  version: number;
  accept_token: string | null;
  offer_message: string | null;
  deposit_amount: number | string;
  offered_at: string | null;
  selected_at: string | null;
  approved_at: string | null;
  selection_id: string | null;
  eligibility_context: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type OptionRow = {
  id: string;
  proposal_id: string;
  venue_id: string;
  source_package_id: string | null;
  offer_role: PackageOfferRole;
  name: string;
  description: string | null;
  unit_price: number | string;
  included_items: ProposalOptionItem[] | null;
  sort_order: number;
  frozen_at: string | null;
  created_at: string;
};

type ChoiceRow = {
  id: string;
  proposal_id: string;
  venue_id: string;
  option_id: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
  name: string;
  offer_role: PackageOfferRole;
  created_at: string;
};

function mapOption(r: OptionRow): CommercialProposalOption {
  return {
    id: r.id,
    proposalId: r.proposal_id,
    venueId: r.venue_id,
    sourcePackageId: r.source_package_id,
    offerRole: r.offer_role,
    name: r.name,
    description: r.description,
    unitPrice: Number(r.unit_price),
    includedItems: Array.isArray(r.included_items) ? r.included_items : [],
    sortOrder: r.sort_order,
    frozenAt: r.frozen_at,
    createdAt: r.created_at,
  };
}

function mapChoice(r: ChoiceRow): CommercialProposalChoice {
  return {
    id: r.id,
    proposalId: r.proposal_id,
    optionId: r.option_id,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    lineTotal: Number(r.line_total),
    name: r.name,
    offerRole: r.offer_role,
  };
}

function mapProposal(
  r: ProposalRow,
  options: CommercialProposalOption[],
  choices: CommercialProposalChoice[],
): CommercialProposal {
  return {
    id: r.id,
    venueId: r.venue_id,
    leadId: r.lead_id,
    clientId: r.client_id,
    eventId: r.event_id,
    status: r.status,
    version: r.version,
    acceptToken: r.accept_token,
    offerMessage: r.offer_message,
    depositAmount: Number(r.deposit_amount),
    offeredAt: r.offered_at,
    selectedAt: r.selected_at,
    approvedAt: r.approved_at,
    selectionId: r.selection_id,
    eligibilityContext: r.eligibility_context ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    options,
    choices,
  };
}

async function loadOptions(
  client: SupabaseClient,
  proposalId: string,
): Promise<CommercialProposalOption[]> {
  const { data, error } = await client
    .from("commercial_proposal_options")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as OptionRow[]).map(mapOption);
}

async function loadChoices(
  client: SupabaseClient,
  proposalId: string,
): Promise<CommercialProposalChoice[]> {
  const { data, error } = await client
    .from("commercial_proposal_choices")
    .select("*")
    .eq("proposal_id", proposalId);
  if (error) throw error;
  return ((data ?? []) as ChoiceRow[]).map(mapChoice);
}

export async function getProposal(
  client: SupabaseClient,
  venueId: string,
  id: string,
): Promise<CommercialProposal | null> {
  const { data, error } = await client
    .from("commercial_proposals")
    .select("*")
    .eq("venue_id", venueId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [options, choices] = await Promise.all([
    loadOptions(client, id),
    loadChoices(client, id),
  ]);
  return mapProposal(data as ProposalRow, options, choices);
}

export async function getActiveProposalForLead(
  client: SupabaseClient,
  venueId: string,
  leadId: string,
): Promise<CommercialProposal | null> {
  const { data, error } = await client
    .from("commercial_proposals")
    .select("*")
    .eq("venue_id", venueId)
    .eq("lead_id", leadId)
    .not("status", "in", '("superseded","withdrawn")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getProposal(client, venueId, (data as ProposalRow).id);
}

export async function getActiveProposalForClient(
  client: SupabaseClient,
  venueId: string,
  clientId: string,
): Promise<CommercialProposal | null> {
  const { data, error } = await client
    .from("commercial_proposals")
    .select("*")
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .not("status", "in", '("superseded","withdrawn")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getProposal(client, venueId, (data as ProposalRow).id);
}

export async function insertProposal(
  client: SupabaseClient,
  venueId: string,
  input: {
    leadId?: string;
    clientId?: string;
    eventId?: string;
    depositAmount: number;
    offerMessage?: string | null;
    eligibilityContext?: Record<string, unknown>;
  },
): Promise<CommercialProposal> {
  const { data, error } = await client
    .from("commercial_proposals")
    .insert({
      venue_id: venueId,
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      event_id: input.eventId ?? null,
      deposit_amount: input.depositAmount,
      offer_message: input.offerMessage ?? null,
      eligibility_context: input.eligibilityContext ?? {},
      status: "draft",
      version: 1,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapProposal(data as ProposalRow, [], []);
}

export async function insertProposalOption(
  client: SupabaseClient,
  venueId: string,
  proposalId: string,
  input: {
    sourcePackageId: string;
    offerRole: PackageOfferRole;
    name: string;
    description: string | null;
    unitPrice: number;
    includedItems: ProposalOptionItem[];
    sortOrder: number;
    frozenAt?: string | null;
  },
): Promise<CommercialProposalOption> {
  const { data, error } = await client
    .from("commercial_proposal_options")
    .insert({
      proposal_id: proposalId,
      venue_id: venueId,
      source_package_id: input.sourcePackageId,
      offer_role: input.offerRole,
      name: input.name,
      description: input.description,
      unit_price: input.unitPrice,
      included_items: input.includedItems,
      sort_order: input.sortOrder,
      frozen_at: input.frozenAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapOption(data as OptionRow);
}

export async function markProposalSent(
  client: SupabaseClient,
  venueId: string,
  proposalId: string,
  acceptToken: string,
  message: string | null,
): Promise<CommercialProposal | null> {
  const now = new Date().toISOString();
  await client
    .from("commercial_proposal_options")
    .update({ frozen_at: now })
    .eq("proposal_id", proposalId)
    .eq("venue_id", venueId)
    .is("frozen_at", null);

  const { data, error } = await client
    .from("commercial_proposals")
    .update({
      status: "sent",
      accept_token: acceptToken,
      offer_message: message,
      offered_at: now,
    })
    .eq("id", proposalId)
    .eq("venue_id", venueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getProposal(client, venueId, proposalId);
}

export async function withdrawProposal(
  client: SupabaseClient,
  venueId: string,
  proposalId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("commercial_proposals")
    .update({ status: "withdrawn" })
    .eq("id", proposalId)
    .eq("venue_id", venueId)
    .in("status", ["sent", "selected"])
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function getLatestWithdrawnProposalForLead(
  client: SupabaseClient,
  venueId: string,
  leadId: string,
): Promise<CommercialProposal | null> {
  const { data, error } = await client
    .from("commercial_proposals")
    .select("id")
    .eq("venue_id", venueId)
    .eq("lead_id", leadId)
    .eq("status", "withdrawn")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getProposal(client, venueId, (data as { id: string }).id);
}

export async function getLatestWithdrawnProposalForClient(
  client: SupabaseClient,
  venueId: string,
  clientId: string,
): Promise<CommercialProposal | null> {
  const { data, error } = await client
    .from("commercial_proposals")
    .select("id")
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .eq("status", "withdrawn")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getProposal(client, venueId, (data as { id: string }).id);
}

export async function supersedeProposal(
  client: SupabaseClient,
  venueId: string,
  proposalId: string,
): Promise<void> {
  await client
    .from("commercial_proposals")
    .update({ status: "superseded" })
    .eq("id", proposalId)
    .eq("venue_id", venueId)
    .neq("status", "approved");
}

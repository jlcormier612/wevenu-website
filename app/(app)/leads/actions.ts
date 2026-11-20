"use server";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { loadBookedMembershipSets } from "@/lib/booking-journey/booked-membership";
import { loadLeadMessageAttentionMap } from "@/lib/leads/message-attention";
import type { LeadMessageAttention } from "@/lib/leads/message-attention";
import {
  LEADS_PAGE_SIZE,
  type LeadsListAttention,
  type LeadsListSort,
} from "@/lib/leads/list-query";
import { createLead, getLeadsListPage } from "@/lib/leads/service";
import type { CreateLeadResult, Lead, LeadInput } from "@/lib/leads/types";
import { getUnattendedInquiryLeadIdsForCurrentVenue } from "@/lib/luv/unattended-inquiry-population";

export async function createLeadAction(
  input: LeadInput,
): Promise<CreateLeadResult> {
  return createLead(input);
}

export type LoadMoreLeadsInput = {
  q?: string;
  status?: string;
  eventType?: string;
  sort?: LeadsListSort;
  attention?: LeadsListAttention;
  outcome?: "active" | "lost";
  /** Current number of rows already shown (next fetch starts here). */
  offset: number;
  limit?: number;
};

export type LoadMoreLeadsResult = {
  ok: true;
  leads: Lead[];
  messageAttentionByLeadId: Record<string, LeadMessageAttention>;
  totalMatching: number;
  offset: number;
  hasMore: boolean;
} | {
  ok: false;
  message: string;
};

/** Progressive Leads window — next chunk only; filters apply to the full eligible set. */
export async function loadMoreLeadsAction(
  input: LoadMoreLeadsInput,
): Promise<LoadMoreLeadsResult> {
  const limit = input.limit ?? LEADS_PAGE_SIZE;
  const offset = Math.max(0, input.offset);
  const attention = input.attention ?? "all";
  const outcome = input.outcome ?? "active";

  const [bookedMembership, unattendedInquiryLeadIds] = await Promise.all([
    loadBookedMembershipSets(),
    attention === "unattended_inquiry"
      ? getUnattendedInquiryLeadIdsForCurrentVenue()
      : Promise.resolve([] as string[]),
  ]);

  const listPage = await getLeadsListPage({
    q: input.q ?? "",
    status: input.status ?? (outcome === "lost" ? "lost" : "all"),
    eventType: input.eventType ?? "all",
    sort: input.sort ?? "newest",
    attention,
    outcome,
    offset,
    pageSize: limit,
    unattendedInquiryLeadIds,
    currentBookedCount: bookedMembership.currentClientIds.size,
  });

  const messageAttentionByLeadId: Record<string, LeadMessageAttention> = {};
  if (isSupabaseConfigured && listPage.leads.length > 0) {
    const supabase = await createClient();
    const map = await loadLeadMessageAttentionMap(
      supabase,
      listPage.leads.map((l) => ({ id: l.id, relationshipId: l.relationshipId })),
    );
    for (const [id, att] of map) {
      messageAttentionByLeadId[id] = att;
    }
  }

  return {
    ok: true,
    leads: listPage.leads,
    messageAttentionByLeadId,
    totalMatching: listPage.totalMatching,
    offset: listPage.offset,
    hasMore: listPage.hasMore,
  };
}

/** Venue-side possible-match preview. Create still requires an identity decision. */
export async function previewPossibleDuplicateLeadAction(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  partnerFirstName: string;
  partnerLastName: string;
  partnerEmail: string;
}) {
  const { previewPossibleDuplicates } = await import("@/lib/leads/duplicate-review");
  return previewPossibleDuplicates(input);
}

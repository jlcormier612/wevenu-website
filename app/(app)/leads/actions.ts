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
import { leadsFilterFingerprint } from "@/lib/leads/list-navigation";
import { clampLeadsRestoreCount } from "@/lib/leads/list-session";
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
  /** Ids already displayed — next window excludes these (mutation-safe). */
  excludeIds: readonly string[];
  /** Client filter fingerprint; echoed so stale responses can be dropped. */
  filterFingerprint: string;
  limit?: number;
};

export type LoadMoreLeadsResult = {
  ok: true;
  leads: Lead[];
  messageAttentionByLeadId: Record<string, LeadMessageAttention>;
  totalMatching: number;
  hasMore: boolean;
  filterFingerprint: string;
} | {
  ok: false;
  message: string;
  filterFingerprint?: string;
};

/** Progressive Leads window — next chunk only; filters apply to the full eligible set. */
export async function loadMoreLeadsAction(
  input: LoadMoreLeadsInput,
): Promise<LoadMoreLeadsResult> {
  // Bound progressive/restore windows — sessionStorage cannot drive unbounded loads.
  const limit = clampLeadsRestoreCount(input.limit ?? LEADS_PAGE_SIZE);
  const attention = input.attention ?? "all";
  const outcome = input.outcome ?? "active";
  const q = input.q ?? "";
  const status = input.status ?? (outcome === "lost" ? "lost" : "all");
  const eventType = input.eventType ?? "all";
  const sort = input.sort ?? "newest";
  const filterFingerprint = leadsFilterFingerprint({
    q,
    status,
    eventType,
    sort,
    attention,
    outcome,
  });

  // Client sent a fingerprint from a different filter set — refuse rather than append.
  if (input.filterFingerprint !== filterFingerprint) {
    return {
      ok: false,
      message: "Filters changed. Refresh the list and try again.",
      filterFingerprint,
    };
  }

  const [bookedMembership, unattendedInquiryLeadIds] = await Promise.all([
    loadBookedMembershipSets(),
    attention === "unattended_inquiry"
      ? getUnattendedInquiryLeadIdsForCurrentVenue()
      : Promise.resolve([] as string[]),
  ]);

  const listPage = await getLeadsListPage({
    q,
    status,
    eventType,
    sort,
    attention,
    outcome,
    excludeIds: input.excludeIds,
    pageSize: limit,
    unattendedInquiryLeadIds,
    currentBookedCount: bookedMembership.currentClientIds.size,
  });

  if (listPage.indexTruncated) {
    return {
      ok: false,
      message: listPage.indexError ?? "Lead list is temporarily unavailable.",
      filterFingerprint,
    };
  }

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
    hasMore: listPage.hasMore,
    filterFingerprint,
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

import { LeadList } from "@/components/leads/lead-list";
import { loadBookedMembershipSets } from "@/lib/booking-journey/booked-membership";
import { getLeadsListPage } from "@/lib/leads/service";
import { loadLeadMessageAttentionMap } from "@/lib/leads/message-attention";
import type { LeadsListAttention, LeadsListSort } from "@/lib/leads/list-query";
import { getUnattendedInquiryLeadIdsForCurrentVenue } from "@/lib/luv/unattended-inquiry-population";
import { UNATTENDED_INQUIRY_ATTENTION } from "@/lib/luv/unattended-inquiry";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type LeadsListSearchParams = {
  attention?: string;
  view?: string;
  q?: string;
  stage?: string;
  eventType?: string;
  sort?: string;
  page?: string;
};

function parseSort(raw: string | undefined): LeadsListSort {
  const allowed: LeadsListSort[] = [
    "newest",
    "oldest",
    "az",
    "za",
    "event_asc",
    "event_desc",
    "budget_high",
    "budget_low",
    "last_contacted",
    "commitment_high",
  ];
  return allowed.includes(raw as LeadsListSort) ? (raw as LeadsListSort) : "newest";
}

function parseAttention(
  attention: string | undefined,
  outcome: "active" | "lost",
): LeadsListAttention {
  if (outcome === "lost") return "all";
  if (attention === "stale_contact") return "stale_contact";
  if (attention === "open" || attention === "active") return "open";
  if (attention === "unseen") return "unseen";
  if (attention === UNATTENDED_INQUIRY_ATTENTION) return "unattended_inquiry";
  return "all";
}

/** Bounded list window + global counts; message attention only for the page. */
export async function LeadsListIsland({
  searchParams,
}: {
  searchParams: LeadsListSearchParams;
}) {
  const outcome = searchParams.view === "lost" ? ("lost" as const) : ("active" as const);
  const attention = parseAttention(searchParams.attention, outcome);
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const [bookedMembership, unattendedInquiryLeadIds] = await Promise.all([
    loadBookedMembershipSets(),
    attention === "unattended_inquiry"
      ? getUnattendedInquiryLeadIdsForCurrentVenue()
      : Promise.resolve([] as string[]),
  ]);

  const listPage = await getLeadsListPage({
    q: searchParams.q ?? "",
    status: searchParams.stage ?? (outcome === "lost" ? "lost" : "all"),
    eventType: searchParams.eventType ?? "all",
    sort: parseSort(searchParams.sort),
    attention,
    outcome,
    page,
    unattendedInquiryLeadIds,
    currentBookedCount: bookedMembership.currentClientIds.size,
  });

  const messageAttentionByLeadId: Record<string, { conversationId: string; href: string }> = {};
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

  return (
    <LeadList
      leads={listPage.leads}
      totalLeads={listPage.totalLeads}
      totalMatching={listPage.totalMatching}
      page={listPage.page}
      pageSize={listPage.pageSize}
      totalPages={listPage.totalPages}
      statusCounts={listPage.statusCounts}
      eventTypeCounts={listPage.eventTypeCounts}
      initialAttention={attention === "all" ? null : attention}
      initialOutcome={outcome}
      initialQuery={listPage.params.q}
      initialStatus={listPage.params.status}
      initialEventType={listPage.params.eventType}
      initialSort={listPage.params.sort}
      unattendedInquiryLeadIds={unattendedInquiryLeadIds}
      currentBookedCount={bookedMembership.currentClientIds.size}
      messageAttentionByLeadId={messageAttentionByLeadId}
    />
  );
}

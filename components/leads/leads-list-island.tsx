import { Suspense } from "react";
import { LeadList } from "@/components/leads/lead-list";
import { LeadsBookedChipCount } from "@/components/leads/leads-booked-chip-count";
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

/** First progressive window + global counts; message attention only for that window. */
export async function LeadsListIsland({
  searchParams,
}: {
  searchParams: LeadsListSearchParams;
}) {
  const outcome = searchParams.view === "lost" ? ("lost" as const) : ("active" as const);
  const attention = parseAttention(searchParams.attention, outcome);
  const needsUnattendedIds = attention === "unattended_inquiry";

  const listParamsBase = {
    q: searchParams.q ?? "",
    status: searchParams.stage ?? (outcome === "lost" ? "lost" : "all"),
    eventType: searchParams.eventType ?? "all",
    sort: parseSort(searchParams.sort),
    attention,
    outcome,
    offset: 0 as const,
  };

  // Step 2: list + attention on the critical path. Booked chip count streams in
  // under Suspense (authoritative membership stays correct, just deferred).
  // Unattended attention still needs qualifying IDs before the page query.
  let unattendedInquiryLeadIds: string[] = [];
  if (needsUnattendedIds) {
    unattendedInquiryLeadIds = await getUnattendedInquiryLeadIdsForCurrentVenue();
  }

  const listPage = await getLeadsListPage({
    ...listParamsBase,
    unattendedInquiryLeadIds,
    currentBookedCount: 0,
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
      pageSize={listPage.pageSize}
      hasMore={listPage.hasMore}
      statusCounts={listPage.statusCounts}
      eventTypeCounts={listPage.eventTypeCounts}
      initialAttention={attention === "all" ? null : attention}
      initialOutcome={outcome}
      initialQuery={listPage.params.q}
      initialStatus={listPage.params.status}
      initialEventType={listPage.params.eventType}
      initialSort={listPage.params.sort}
      unattendedInquiryLeadIds={unattendedInquiryLeadIds}
      currentBookedCount={0}
      bookedCountSlot={
        <Suspense fallback={<span aria-hidden="true">…</span>}>
          <LeadsBookedChipCount />
        </Suspense>
      }
      messageAttentionByLeadId={messageAttentionByLeadId}
      indexError={listPage.indexError}
    />
  );
}

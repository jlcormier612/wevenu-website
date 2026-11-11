/**
 * Today's Focus "new inquiry / no follow-up scheduled" eligibility.
 *
 * Pipeline sales_stage is not evidence that the relationship is still an
 * inquiry. Stronger Luv/snapshot lifecycle facts (booked, lost, contract
 * sent/signed/executed) mean this copy must not fire.
 *
 * Overdue scheduled follow-ups are a different Focus row and are not
 * gated here.
 */
import { isOpenLeadLifecycle } from "@/lib/leads/open-lifecycle";
import { classifySnapshotLifecycleMilestone } from "@/lib/leads/snapshot-lifecycle";
import {
  isAuthoritativeBooked,
  isAuthoritativeLost,
} from "@/lib/luv/pipeline-stage-evidence";

export type StaleInquiryLifecycleFacts = {
  firstBookedAt?: string | null;
  lostAt?: string | null;
  contractStatus?: string | null;
  venueSigned?: boolean;
  requiredClientTotal?: number;
  requiredClientSigned?: number;
};

/** True when authoritative facts show the relationship has left early inquiry. */
export function hasProgressedPastEarlyInquiry(
  facts: StaleInquiryLifecycleFacts,
): boolean {
  if (isAuthoritativeBooked({ firstBookedAt: facts.firstBookedAt })) return true;
  if (isAuthoritativeLost({ lostAt: facts.lostAt })) return true;
  const milestone = classifySnapshotLifecycleMilestone({
    isBooked: false,
    contractStatus: facts.contractStatus ?? null,
    venueSigned: facts.venueSigned ?? false,
    requiredClientTotal: facts.requiredClientTotal ?? 1,
    requiredClientSigned: facts.requiredClientSigned ?? 0,
  });
  return milestone !== "early";
}

/**
 * Whether Focus may describe this lead as a stale new inquiry with no
 * follow-up scheduled. Does not consult sales_stage as proof.
 */
export function qualifiesAsStaleNewInquiryAttention(
  lead: {
    salesStage?: string | null;
    status?: string | null;
    followUpDate?: string | null;
    createdAt: string;
  },
  facts: StaleInquiryLifecycleFacts,
  today: string,
  twoDaysAgoMs: number,
): boolean {
  const stage = lead.salesStage ?? lead.status;
  if (!isOpenLeadLifecycle(stage)) return false;
  if (lead.followUpDate) return false;
  if (new Date(lead.createdAt).getTime() >= twoDaysAgoMs) return false;
  if (hasProgressedPastEarlyInquiry(facts)) return false;
  return true;
}

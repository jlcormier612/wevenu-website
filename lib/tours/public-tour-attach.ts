/**
 * Resolve which Lead a public tour booking should attach to.
 * Does not create records. Name-only matching is intentionally absent.
 */
import { isOpenLeadLifecycle } from "@/lib/leads/open-lifecycle";
import { normalizeEmail } from "@/lib/leads/duplicate-detection";
import {
  verifyTourOriginToken,
  type TourOriginPayload,
} from "@/lib/tours/origin-context";

export type PublicTourLeadRow = {
  id: string;
  venueId: string;
  salesStage: string | null;
  email: string | null;
  partnerEmail: string | null;
  relationshipId: string | null;
};

export type PublicTourAttachDecision =
  | { action: "attach"; leadId: string; relationshipId: string | null; source: "origin" | "email" }
  | { action: "create" }
  | { action: "reject"; error: string };

export function decidePublicTourAttach(opts: {
  venueId: string;
  originToken?: string | null;
  signingSecret: string | null;
  originLead: PublicTourLeadRow | null;
  email: string | null | undefined;
  openEmailMatches: PublicTourLeadRow[];
  nowMs?: number;
}): PublicTourAttachDecision {
  if (opts.originToken?.trim()) {
    if (!opts.signingSecret) {
      return { action: "reject", error: "This scheduling link is not valid." };
    }
    const payload = verifyTourOriginToken(
      opts.originToken,
      opts.signingSecret,
      opts.nowMs,
    );
    if (!payload) {
      return { action: "reject", error: "This scheduling link is not valid." };
    }
    return decideFromOriginPayload(payload, opts.venueId, opts.originLead);
  }

  const email = normalizeEmail(opts.email);
  if (!email) return { action: "create" };
  const open = opts.openEmailMatches.filter(
    (row) =>
      row.venueId === opts.venueId &&
      isOpenLeadLifecycle(row.salesStage) &&
      (normalizeEmail(row.email) === email || normalizeEmail(row.partnerEmail) === email),
  );
  if (open.length === 1) {
    const lead = open[0]!;
    return {
      action: "attach",
      leadId: lead.id,
      relationshipId: lead.relationshipId,
      source: "email",
    };
  }
  return { action: "create" };
}

function decideFromOriginPayload(
  payload: TourOriginPayload,
  venueId: string,
  originLead: PublicTourLeadRow | null,
): PublicTourAttachDecision {
  if (payload.venueId !== venueId) {
    return { action: "reject", error: "This scheduling link is not valid." };
  }
  if (!originLead || originLead.id !== payload.leadId) {
    return { action: "reject", error: "This scheduling link is not valid." };
  }
  if (originLead.venueId !== venueId) {
    return { action: "reject", error: "This scheduling link is not valid." };
  }
  if (!isOpenLeadLifecycle(originLead.salesStage)) {
    return { action: "reject", error: "This scheduling link is no longer valid." };
  }
  return {
    action: "attach",
    leadId: originLead.id,
    relationshipId: originLead.relationshipId,
    source: "origin",
  };
}

export function rowMatchesNormalizedEmail(
  row: Pick<PublicTourLeadRow, "email" | "partnerEmail">,
  email: string,
): boolean {
  return normalizeEmail(row.email) === email || normalizeEmail(row.partnerEmail) === email;
}

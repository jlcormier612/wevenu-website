/**
 * Resolve venue-facing Pipeline stage names for Automation trigger display.
 * Storage stays LeadStatus; this is render-time only.
 */
import { LEAD_STATUS_TO_CANONICAL_STAGE } from "@/lib/leads/pipeline-stage-mapping";
import type { LeadStatus } from "@/lib/leads/types";
import { statusLabel } from "@/lib/leads/constants";
import type { CanonicalStage } from "@/lib/pipeline-templates/types";

export type StageNameLookup = {
  name: string;
  canonicalStage: CanonicalStage;
  sortOrder: number;
};

/** First active-template stage (by sort) matching this LeadStatus's canonical mapping. */
export function venueStageNameForLeadStatus(
  status: string,
  stages: StageNameLookup[],
): string | null {
  const canonical = LEAD_STATUS_TO_CANONICAL_STAGE[status as LeadStatus];
  if (!canonical) return null;
  const matches = stages
    .filter((s) => s.canonicalStage === canonical)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return matches[0]?.name ?? null;
}

/**
 * Picker / summary label: "Proposal Sent · Let's Talk Numbers" when the
 * venue has a custom name; otherwise just the LeadStatus label.
 */
export function triggerStageDisplayLabel(
  leadStatus: string,
  stages: StageNameLookup[],
): string {
  const base = statusLabel(leadStatus);
  const venueName = venueStageNameForLeadStatus(leadStatus, stages);
  if (venueName && venueName !== base) return `${base} · ${venueName}`;
  return base;
}

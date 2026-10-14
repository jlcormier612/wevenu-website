/**
 * Per-row unseen cue — same eligibility as the Leads nav attention badge
 * (`isUnseenLeadAttention` / venue_seen_at + open lifecycle).
 */
import { isUnseenLeadAttention } from "@/lib/navigation/attention";

export function leadShowsUnseenIndicator(row: {
  venueSeenAt: string | null;
  salesStage: string | null;
}): boolean {
  return isUnseenLeadAttention(row);
}

/** Subtle pink dot + "New" beside a lead name. Null when not unseen. */
export function LeadUnseenIndicator({
  venueSeenAt,
  salesStage,
}: {
  venueSeenAt: string | null;
  salesStage: string | null;
}) {
  if (!leadShowsUnseenIndicator({ venueSeenAt, salesStage })) return null;
  return (
    <span
      data-testid="lead-unseen-indicator"
      className="inline-flex items-center gap-1 shrink-0"
      aria-label="New unseen lead"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-destructive"
        aria-hidden
      />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
        New
      </span>
    </span>
  );
}

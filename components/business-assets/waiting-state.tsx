import { Badge, type BadgeVariant } from "@/components/ui/badge";

/**
 * Business Asset Experience Consolidation (Work Package BA4, Step 1C).
 *
 * Messaging already solved "whose turn is it?" (its Inbox shows "Waiting
 * for Client" / "Waiting for Venue" stat tiles); Questionnaires already
 * solved it in prose ("Sent — waiting for the client to open it."). This
 * is that same pattern, generalized — not a new interaction, a shared
 * presentation for one that already existed twice.
 */
export type WaitingOn = "client" | "venue" | "vendor" | "completed" | "none";

const WAITING_META: Record<WaitingOn, { label: string; variant: BadgeVariant }> = {
  client:    { label: "Waiting on Client", variant: "warning" },
  venue:     { label: "Waiting on Venue",  variant: "default" },
  vendor:    { label: "Waiting on Vendor", variant: "warning" },
  completed: { label: "Completed",         variant: "success" },
  none:      { label: "No Action Required", variant: "muted" },
};

export function WaitingStateBadge({ waitingOn }: { waitingOn: WaitingOn }) {
  const meta = WAITING_META[waitingOn];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

/** The Questionnaire's own sentence pattern, generalized — same shape, asset-specific detail. */
export function waitingStateSentence(waitingOn: WaitingOn, detail?: string): string {
  switch (waitingOn) {
    case "client": return detail ?? "Sent — waiting for the client.";
    case "venue": return detail ?? "Waiting on your venue to take the next step.";
    case "vendor": return detail ?? "Sent — waiting for the vendor.";
    case "completed": return detail ?? "Complete — nothing more to do.";
    case "none": return detail ?? "Nothing to act on right now.";
  }
}

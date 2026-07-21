/**
 * Activity Timeline (RC2, Milestone 4) — the relationship's audit trail:
 * "what happened," not "what was said." A read-only composed view over
 * every existing business-event source (leads, clients, events, payments,
 * invoices, requests, contracts, timeline submissions, guest counts,
 * vendor assignments) plus Conversation activity collapsed into
 * "Conversation started"/"Conversation resumed" narrative markers — never
 * one row per message. See get_relationship_activity_timeline RPC.
 */
export type ActivityTimelineSource =
  | "lead" | "client" | "event" | "payment" | "invoice" | "request"
  | "contract" | "timeline" | "guests" | "vendor" | "conversation";

export type ActivityTimelineEvent = {
  source: ActivityTimelineSource;
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
};

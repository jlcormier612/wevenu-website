/**
 * Luv — your venue assistant.
 *
 * Phase 1: Notice. Pure data pattern matching; no AI calls required.
 * Phase 2: Draft. Generated content reviewed before any action.
 * Phase 3: Assist. Proactive, trusted.
 */

export type LuvPriority = "high" | "medium" | "low";

export type LuvBriefingItem = {
  label: string;
  status: "complete" | "incomplete" | "warning";
  detail?: string;
  link?: string;
};

export type LuvObservation = {
  id: string;            // stable key for React rendering
  priority: LuvPriority;
  message: string;       // the observation, written warmly
  detail?: string;       // secondary line (optional)
  link: string;          // where to navigate on click
  actionLabel?: string;  // label for the link (default: "View →")
  // When present: render as a grouped coordinator briefing card
  briefingItems?: LuvBriefingItem[];
  daysUntil?: number;
};

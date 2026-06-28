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

/**
 * A structured recommended action attached to a Luv observation.
 * Always a suggestion — coordinator remains in control.
 * type='draft' routes to the Luv tab with a draft pre-selected.
 */
export type LuvRecommendation = {
  label: string;  // "Ask Luv to draft a follow-up", "Build the timeline", etc.
  link: string;   // destination URL (may include ?luv= param for draft routing)
  type: "navigate" | "draft" | "task";
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
  // The suggested next step — what to do with this intelligence
  recommendation?: LuvRecommendation;
};

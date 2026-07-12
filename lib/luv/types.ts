/**
 * Luv — your venue assistant.
 *
 * Phase 1: Notice. Pure data pattern matching; no AI calls required.
 * Phase 2: Draft. Generated content reviewed before any action.
 * Phase 3: Assist. Proactive, trusted.
 */

export type LuvPriority = "high" | "medium" | "low";

/**
 * The unified observation contract (Platform Intelligence Adoption — Phase 1,
 * per docs/luv-platform-reconciliation.md §4). Exactly six kinds, no more —
 * every observation is tagged with the single most specific one that
 * applies, in this precedence order when more than one could:
 * celebration > risk > waiting > recommendation > inference > fact.
 *
 *   fact           a direct, unadorned read of existing state
 *   inference      a conclusion combining two or more facts (must be
 *                  traceable back to them, never presented at fact-level certainty)
 *   recommendation a suggested next action, always a link, never something
 *                  Luv performs itself
 *   celebration    a fact that is also the first occurrence of a real,
 *                  one-time transition (see docs/luv-platform-intelligence-architecture.md §2)
 *   waiting        depends on someone else's next action, no due-date urgency yet
 *   risk           a fact plus an existing, feature-native threshold already
 *                  crossed — never a threshold Luv invents itself
 */
export type ObservationKind = "fact" | "inference" | "recommendation" | "celebration" | "waiting" | "risk";

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
  kind: ObservationKind;
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
  // Story Mode — renders as a named narrative headline instead of a data row
  variant?: "story";
  storyEvidence?: string[]; // supporting data points shown beneath the headline
};

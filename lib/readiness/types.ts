/**
 * Event Readiness — Phase 1: Platform Integration.
 *
 * Deliberately a distinct name from the two existing "readiness" concepts
 * already in the codebase — lib/playbooks/types.ts's EventReadiness (a
 * Planning-only task-completion score) and the dead lib/luv/event-
 * readiness.ts's EventReadiness (a superseded 8-item checklist, unused
 * outside its own orphaned components). This one is the cross-capability
 * rollup neither of those is: it summarizes what Planning's own
 * EventReadiness (among nine other capabilities) already computes, it does
 * not replace or merge with it.
 */

export type ReadinessStatus = "complete" | "needs_attention" | "waiting" | "not_started";

/** Where clicking a section actually takes the coordinator. */
export type ReadinessNavTarget =
  | { kind: "tab"; tab: string }
  | { kind: "portal"; section: string }
  | { kind: "scroll"; elementId: string }
  /** A page within the Booking Workspace itself (e.g. Wedding Day Seating) — same-tab navigation, distinct from "portal", which crosses into the couple's own Wedding Workspace in a new tab. */
  | { kind: "link"; href: string };

export type ReadinessSection = {
  key: string;
  label: string;
  status: ReadinessStatus;
  /** One short, human sentence — the "what's true right now" for this capability. */
  detail: string;
  /** Optional compact readout (e.g. "8/10", "62%") — only when the source data already tracks it. */
  metric?: string;
  nav: ReadinessNavTarget;
};

export type EventReadinessSummary = {
  overallStatus: ReadinessStatus;
  headline: string;
  /** Sorted most-urgent first (needs_attention → waiting → not_started → complete) — the point of the card. */
  sections: ReadinessSection[];
};

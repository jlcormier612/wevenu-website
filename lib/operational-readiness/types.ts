/**
 * Operational Readiness Model (docs/migration-cutover-architecture.md §D).
 *
 * Deliberately a distinct module from the existing lib/readiness/ (Event
 * Readiness — a per-*event* rollup of Contracts/Payments/Requests/Planning/
 * Timeline for one booking, already used by the Booking Workspace and
 * Luv's briefing service). This is per-*venue*: whether the venue itself
 * has what it needs to take its next new inquiry through a real workflow —
 * a different question, a different audience, computed from different
 * tables. Not a rename or an extension of Event Readiness; a sibling.
 *
 * Also deliberately separate from, and never a gate on, Setup Hub's own
 * self-declared `ready_to_invite_couples` graduation flag — that flag stays
 * exactly as it is. This answers a narrower question with computed, real
 * product state instead of a click-through.
 */

export type OperationalReadinessDomainKey =
  | "lead_capture"
  | "tour_availability"
  | "pricing"
  | "contracts"
  | "payments"
  | "planning"
  | "communications"
  | "team";

export type OperationalReadinessDomain = {
  key: OperationalReadinessDomainKey;
  label: string;
  ready: boolean;
  /** A short, encouraging explanation of what's ready or what's missing. */
  detail: string;
  /** Where to go to close this specific gap. */
  href: string;
  /** True when this domain doesn't apply to this venue's workflow (e.g. tours disabled) — never counted against readiness. */
  notApplicable: boolean;
};

export type OperationalReadiness = {
  domains: OperationalReadinessDomain[];
  readyCount: number;
  applicableCount: number;
};

/**
 * White-Glove Customer Success Workspace — the Onboarding Engagement
 * (Hospitality Success Platform §2.2a, Phase 2). A session-spanning case
 * file for a venue's staff-assisted implementation, one layer above a
 * single import_batches run.
 */

export type OnboardingEngagementStatus = "not_started" | "in_progress" | "paused" | "blocked" | "complete";

export type OnboardingEngagement = {
  id: string;
  venueId: string;
  // Resolving this to a display name needs the HQ admin roster (email/name
  // per hq_admins row) — not built yet (docs/wevenu-hq-architecture.md §1
  // lists "HQ Admin Roster" itself as not-yet-built). The cross-account
  // dashboard (§2.2a step 3) is the right place to add that resolution
  // once, batched, rather than each engagement read doing its own lookup.
  assignedHqAdminId: string | null;
  status: OnboardingEngagementStatus;
  currentFocus: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  resumedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Cross-account dashboard row (§2.2a "Cross-account dashboard") — the
// engagement plus the venue name, resolved specialist name, and open-blocker
// count it's always shown alongside. Computed alongside the engagement
// list, never stored.
export type OnboardingEngagementSummary = OnboardingEngagement & {
  venueName: string;
  assignedName: string | null;
  openBlockerCount: number;
};

export type OnboardingActionResult =
  | { ok: true }
  | { ok: false; message?: string };

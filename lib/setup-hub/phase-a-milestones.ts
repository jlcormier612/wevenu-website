/**
 * Phase A — Four-milestone Setup Hub readiness (descriptive, not visit-based).
 * Calendar Ready never substitutes a checkbox for unresolved migration safety.
 */
import {
  makeHtcYoursMilestoneStatusFromSections,
  makeHtcYoursSectionStatuses,
  type PackageReadinessSnapshot,
  type SetupProfileAssignmentSnapshot,
  type SetupProfileSnapshot,
} from "@/lib/setup-hub/phase-b1-readiness";
import type { ExistingBookingsAnswer, MilestoneStatus, SetupHubState } from "@/lib/setup-hub/types";

export const PHASE_A_MILESTONE_ROUTES = {
  protectCalendar: "/setup-hub/protect-calendar",
  makeHtcYours: "/setup-hub/make-htc-yours",
  bringBusiness: "/setup-hub/bring-business",
  takeALook: "/setup-hub/take-a-look",
} as const;

export type PhaseAMilestoneKey = keyof typeof PHASE_A_MILESTONE_ROUTES;

export type PhaseAProgressInput = {
  hubState: SetupHubState | null;
  spacesCount: number;
  hasMigrationImport: boolean;
  /** Brand/contact minimum for Milestone 02 descriptive progress. */
  venueBrandStarted: boolean;
  /** Kept for call-site compatibility. Never used as Milestone 02 Ready proof. */
  setupProfileCount: number;
  packages?: PackageReadinessSnapshot[];
  contractStarterCount?: number;
  setupProfileAssignments?: SetupProfileAssignmentSnapshot[];
  setupProfiles?: SetupProfileSnapshot[];
  messageTemplateCount?: number;
  pausedAutomationCount?: number;
  operationalStarterAvailable?: boolean;
};

export type PhaseAMilestoneView = {
  key: PhaseAMilestoneKey;
  number: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  status: MilestoneStatus;
  statusLabel: string;
};

function statusLabel(status: MilestoneStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "ready":
      return "Ready";
    case "needs_attention":
      return "Needs attention";
  }
}

export function bringBusinessNothingToBringOver(input: {
  existingBookingsAnswer: ExistingBookingsAnswer | null;
  hasMigrationImport: boolean;
  bringYourBusinessPath: string | null;
}): boolean {
  if (input.hasMigrationImport) return false;
  return (
    bringBusinessStatus(input) === "ready" &&
    (input.existingBookingsAnswer === "no" || input.bringYourBusinessPath === "skipped")
  );
}

function bringBusinessStatusLabel(input: {
  existingBookingsAnswer: ExistingBookingsAnswer | null;
  hasMigrationImport: boolean;
  bringYourBusinessPath: string | null;
}): string {
  if (bringBusinessNothingToBringOver(input)) return "Nothing to bring over";
  return statusLabel(bringBusinessStatus(input));
}

/**
 * Milestone 01 calendar readiness.
 * Ready only when: ≥1 space, booking rules reviewed, existing-bookings answered,
 * and if Yes — migration import present (reconciliation not fully exposed → Needs attention until import exists; still not Ready without verified reconciliation).
 *
 * Spec: if Yes, do not mark complete until imported booked events + space assignments reconciled.
 * Reliable reconciliation state is not exposed → never Ready when answer is Yes (Needs attention / pending).
 */
export function calendarMilestoneStatus(input: {
  spacesCount: number;
  bookingRulesReviewedAt: string | null;
  existingBookingsAnswer: ExistingBookingsAnswer | null;
  hasMigrationImport: boolean;
}): MilestoneStatus {
  const { spacesCount, bookingRulesReviewedAt, existingBookingsAnswer, hasMigrationImport } = input;
  const anyProgress =
    spacesCount > 0 || Boolean(bookingRulesReviewedAt) || existingBookingsAnswer != null;

  if (!anyProgress) return "not_started";

  if (spacesCount < 1 || !bookingRulesReviewedAt || existingBookingsAnswer == null) {
    return "in_progress";
  }

  if (existingBookingsAnswer === "no") {
    return "ready";
  }

  // Yes — migration required; reconciliation not reliably persisted → never Ready in Phase A.
  if (!hasMigrationImport) return "needs_attention";
  return "needs_attention";
}

export function makeHtcYoursStatus(input: {
  venueBrandStarted: boolean;
  yourVenueReviewedAt: string | null;
  setupProfileCount?: number;
  clientExperienceReviewedAt?: string | null;
  yourOfferingsReviewedAt?: string | null;
  bookingProcessReviewedAt?: string | null;
  packages?: PackageReadinessSnapshot[];
  contractStarterCount?: number;
  hostedEventTypes?: string[] | null;
  setupProfileAssignments?: SetupProfileAssignmentSnapshot[];
  setupProfiles?: SetupProfileSnapshot[];
  eventExperienceReviews?: SetupHubState["eventExperienceReviews"];
  communicationsReviewedAt?: string | null;
  messageTemplateCount?: number;
  pausedAutomationCount?: number;
  operationalResourcesReviewedAt?: string | null;
  operationalStarterAvailable?: boolean;
}): MilestoneStatus {
  const sections = makeHtcYoursSectionStatuses({
    venueBrandStarted: input.venueBrandStarted,
    yourVenueReviewedAt: input.yourVenueReviewedAt,
    bookingProcessReviewedAt: input.bookingProcessReviewedAt ?? null,
    packages: input.packages ?? [],
    contractStarterCount: input.contractStarterCount ?? 0,
    hostedEventTypes: input.hostedEventTypes ?? null,
    assignments: input.setupProfileAssignments ?? [],
    profiles: input.setupProfiles ?? [],
    reviews: input.eventExperienceReviews ?? {},
    communicationsReviewedAt: input.communicationsReviewedAt ?? null,
    templateCount: input.messageTemplateCount ?? 0,
    pausedAutomationCount: input.pausedAutomationCount ?? 0,
    operationalResourcesReviewedAt: input.operationalResourcesReviewedAt ?? null,
    operationalStarterAvailable: input.operationalStarterAvailable ?? false,
  });
  return makeHtcYoursMilestoneStatusFromSections(sections);
}

export function bringBusinessStatus(input: {
  existingBookingsAnswer: ExistingBookingsAnswer | null;
  hasMigrationImport: boolean;
  bringYourBusinessPath: string | null;
}): MilestoneStatus {
  if (input.hasMigrationImport) return "in_progress"; // import exists; verification is Phase C
  if (input.existingBookingsAnswer === "no" || input.bringYourBusinessPath === "skipped") {
    return "ready";
  }
  if (input.existingBookingsAnswer === "yes" || input.bringYourBusinessPath === "individual") {
    return "in_progress";
  }
  return "not_started";
}

export function takeALookStatus(input: { readyToInviteCouples: boolean }): MilestoneStatus {
  // Phase A: framework only — never Ready / never complete activation.
  if (input.readyToInviteCouples) return "ready";
  return "not_started";
}

export function buildPhaseAMilestones(input: PhaseAProgressInput): PhaseAMilestoneView[] {
  const hub = input.hubState;
  const m1 = calendarMilestoneStatus({
    spacesCount: input.spacesCount,
    bookingRulesReviewedAt: hub?.bookingRulesReviewedAt ?? null,
    existingBookingsAnswer: hub?.existingBookingsAnswer ?? null,
    hasMigrationImport: input.hasMigrationImport,
  });
  const m2 = makeHtcYoursStatus({
    venueBrandStarted: input.venueBrandStarted,
    yourVenueReviewedAt: hub?.yourVenueReviewedAt ?? null,
    setupProfileCount: input.setupProfileCount,
    clientExperienceReviewedAt: hub?.clientExperienceReviewedAt ?? null,
    yourOfferingsReviewedAt: hub?.yourOfferingsReviewedAt ?? null,
    bookingProcessReviewedAt: hub?.bookingProcessReviewedAt ?? null,
    packages: input.packages ?? [],
    contractStarterCount: input.contractStarterCount ?? 0,
    hostedEventTypes: hub?.hostedEventTypes ?? null,
    setupProfileAssignments: input.setupProfileAssignments ?? [],
    setupProfiles: input.setupProfiles ?? [],
    eventExperienceReviews: hub?.eventExperienceReviews ?? {},
    communicationsReviewedAt: hub?.communicationsReviewedAt ?? null,
    messageTemplateCount: input.messageTemplateCount ?? 0,
    pausedAutomationCount: input.pausedAutomationCount ?? 0,
    operationalResourcesReviewedAt: hub?.operationalResourcesReviewedAt ?? null,
    operationalStarterAvailable: input.operationalStarterAvailable ?? false,
  });
  const m3Input = {
    existingBookingsAnswer: hub?.existingBookingsAnswer ?? null,
    hasMigrationImport: input.hasMigrationImport,
    bringYourBusinessPath: hub?.bringYourBusinessPath ?? null,
  };
  const m3 = bringBusinessStatus(m3Input);
  const m4 = takeALookStatus({ readyToInviteCouples: hub?.readyToInviteCouples === true });

  return [
    {
      key: "protectCalendar",
      number: "01",
      title: "Protect your calendar",
      description:
        "Set up your spaces, booking rules, and existing events so your availability stays accurate.",
      actionLabel: "Set up your spaces",
      href: PHASE_A_MILESTONE_ROUTES.protectCalendar,
      status: m1,
      statusLabel: statusLabel(m1),
    },
    {
      key: "makeHtcYours",
      number: "02",
      title: "Make HTC yours",
      description:
        "Personalize your brand, booking process, and ready-to-use planning resources.",
      actionLabel: "Personalize your venue",
      href: PHASE_A_MILESTONE_ROUTES.makeHtcYours,
      status: m2,
      statusLabel: statusLabel(m2),
    },
    {
      key: "bringBusiness",
      number: "03",
      title: "Bring your business over",
      description:
        "Move your leads, booked clients and events, vendors, and existing commitments into HTC.",
      actionLabel: "Explore migration",
      href: PHASE_A_MILESTONE_ROUTES.bringBusiness,
      status: m3,
      statusLabel: bringBusinessStatusLabel(m3Input),
    },
    {
      key: "takeALook",
      number: "04",
      title: "Take a look, then go live",
      description:
        "Walk through a sample wedding, preview your client experience, and activate when you're ready.",
      actionLabel: "Preview what's ahead",
      href: PHASE_A_MILESTONE_ROUTES.takeALook,
      status: m4,
      statusLabel: statusLabel(m4),
    },
  ];
}

/** Next incomplete milestone for Continue setup. */
export function nextIncompleteMilestoneHref(milestones: PhaseAMilestoneView[]): string {
  const next = milestones.find((m) => m.status !== "ready");
  return next?.href ?? PHASE_A_MILESTONE_ROUTES.protectCalendar;
}

/** Descriptive progress — never invent a percentage from page visits. */
export function phaseAProgressSummary(milestones: PhaseAMilestoneView[]): string {
  const ready = milestones.filter((m) => m.status === "ready").length;
  const attention = milestones.filter((m) => m.status === "needs_attention").length;
  const inProgress = milestones.filter((m) => m.status === "in_progress").length;
  if (attention > 0) {
    return `${ready} of 4 milestones ready · ${attention} need attention before calendar safety is confirmed.`;
  }
  if (ready === 4) {
    return "All four milestones show Ready — activation still waits until full readiness is verified.";
  }
  return `${ready} of 4 milestones ready · ${inProgress} in progress`;
}

/**
 * Default post-login landing for venue staff.
 * Established venues (setup completed or readiness declared) keep Dashboard.
 * New / incomplete venues land on Setup Hub. Never redirects ordinary Dashboard navigations.
 */
export function venueDefaultLandingPath(input: {
  readyToInviteCouples: boolean;
  setupCompleted: boolean;
}): "/setup-hub" | "/dashboard" {
  if (input.readyToInviteCouples || input.setupCompleted) return "/dashboard";
  return "/setup-hub";
}

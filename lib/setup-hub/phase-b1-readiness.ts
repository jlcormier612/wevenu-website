/**
 * Phase B1 — truthful Milestone 02 section readiness.
 *
 * Never infer Ready from starter-row existence, template counts, or a
 * provisioned wedding Setup Profile. Owner confirmation must be persisted.
 *
 * Event-experience readiness is independent of importing existing booked
 * events. Do not use this module as an import gate.
 */
import { profileHardConfigGaps, profileHardGapSummary } from "@/lib/event-setup/profile-config-gaps";
import type { SetupDecisions } from "@/lib/event-setup/state";
import type { SetupTemplateRefs } from "@/lib/event-setup/template-refs";
import { evaluatePackageEligibility } from "@/lib/packages/eligibility";
import {
  effectiveHostedEventTypes,
  hostedEventTypeOption,
  type HostedEventTypeValue,
} from "@/lib/setup-hub/phase-b1-event-types";
import type { MilestoneStatus } from "@/lib/setup-hub/types";

export type SectionReadinessStatus =
  | "not_started"
  | "starter_available"
  | "needs_review"
  | "in_progress"
  | "ready"
  | "not_using";

export const SECTION_STATUS_LABEL: Record<SectionReadinessStatus, string> = {
  not_started: "Not started",
  starter_available: "Starter available",
  needs_review: "Needs review",
  in_progress: "In progress",
  ready: "Ready",
  not_using: "Not using",
};

export type EventExperienceReview = {
  profileId: string;
  profileUpdatedAt: string;
  confirmedAt: string;
};

export type EventExperienceReviews = Partial<Record<string, EventExperienceReview>>;

export type SetupProfileSnapshot = {
  id: string;
  name: string;
  updatedAt: string;
  decisions?: SetupDecisions;
  templateRefs?: SetupTemplateRefs;
};

export type ExperienceFamilyDisplayStatus =
  | "Not started"
  | "In progress"
  | "Ready"
  | "Needs attention";

export type SetupProfileAssignmentSnapshot = {
  profileId: string;
  eventType: string | null;
};

export type PackageReadinessSnapshot = {
  isActive: boolean;
  basePrice: number | null;
  sourceMasterKey?: string | null;
};

export const OPERATIONAL_RESOURCE_KEYS = [
  "playbooks",
  "timelines",
  "questionnaires",
  "event_orders",
  "inventory",
  "floor_plans",
  "client_guide",
  "documents",
] as const;

export type OperationalResourceKey = (typeof OPERATIONAL_RESOURCE_KEYS)[number];
export type OperationalResourceChoice = "using" | "not_using";
export type OperationalResourceChoices = Partial<
  Record<OperationalResourceKey, OperationalResourceChoice>
>;

export function parseEventExperienceReviews(raw: unknown): EventExperienceReviews {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: EventExperienceReviews = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    if (
      typeof row.profileId === "string" &&
      row.profileId &&
      typeof row.profileUpdatedAt === "string" &&
      row.profileUpdatedAt &&
      typeof row.confirmedAt === "string" &&
      row.confirmedAt
    ) {
      out[key] = {
        profileId: row.profileId,
        profileUpdatedAt: row.profileUpdatedAt,
        confirmedAt: row.confirmedAt,
      };
    }
  }
  return out;
}

export function parseOperationalResourceChoices(raw: unknown): OperationalResourceChoices {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: OperationalResourceChoices = {};
  for (const key of OPERATIONAL_RESOURCE_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === "using" || value === "not_using") out[key] = value;
  }
  return out;
}

export function venueBrandStatus(input: {
  venueBrandStarted: boolean;
  yourVenueReviewedAt: string | null;
}): SectionReadinessStatus {
  if (input.yourVenueReviewedAt) return "ready";
  if (input.venueBrandStarted) return "in_progress";
  return "not_started";
}

export function hasUnpricedActivePackages(packages: PackageReadinessSnapshot[]): boolean {
  return packages.some((pkg) => {
    if (!pkg.isActive) return false;
    return evaluatePackageEligibility(pkg).reason === "unpriced";
  });
}

export function bookingProcessStatus(input: {
  bookingProcessReviewedAt: string | null;
  packages: PackageReadinessSnapshot[];
  contractStarterCount: number;
}): SectionReadinessStatus {
  const unpricedActive = hasUnpricedActivePackages(input.packages);
  if (input.bookingProcessReviewedAt && !unpricedActive) return "ready";
  if (input.bookingProcessReviewedAt && unpricedActive) return "needs_review";
  if (input.packages.length > 0 || input.contractStarterCount > 0) return "starter_available";
  return "not_started";
}

export function communicationsStatus(input: {
  communicationsReviewedAt: string | null;
  templateCount: number;
  pausedAutomationCount: number;
}): SectionReadinessStatus {
  if (input.communicationsReviewedAt) return "ready";
  if (input.templateCount > 0 || input.pausedAutomationCount > 0) return "starter_available";
  return "not_started";
}

export function operationalResourcesStatus(input: {
  operationalResourcesReviewedAt: string | null;
  starterAvailable: boolean;
}): SectionReadinessStatus {
  if (input.operationalResourcesReviewedAt) return "ready";
  if (input.starterAvailable) return "starter_available";
  return "not_started";
}

export function assignedProfileForEventType(
  eventType: string,
  assignments: SetupProfileAssignmentSnapshot[],
  profiles: SetupProfileSnapshot[],
): SetupProfileSnapshot | null {
  const assignment = assignments.find((row) => row.eventType === eventType);
  if (!assignment) return null;
  return profiles.find((profile) => profile.id === assignment.profileId) ?? null;
}

export type EventTypeReadiness = {
  eventType: HostedEventTypeValue;
  status: SectionReadinessStatus;
  profile: SetupProfileSnapshot | null;
  review: EventExperienceReview | null;
  reason: "not_selected" | "needs_setup" | "needs_review" | "stale" | "ready";
};

/**
 * A confirmation is valid only while the same profile remains assigned and
 * its updated_at still matches the confirmed snapshot. Unrelated venue
 * changes do not invalidate it.
 */
export function isEventTypeReviewValid(input: {
  eventType: string;
  assignments: SetupProfileAssignmentSnapshot[];
  profiles: SetupProfileSnapshot[];
  reviews: EventExperienceReviews;
}): boolean {
  const profile = assignedProfileForEventType(input.eventType, input.assignments, input.profiles);
  const review = input.reviews[input.eventType];
  if (!profile || !review) return false;
  return review.profileId === profile.id && review.profileUpdatedAt === profile.updatedAt;
}

export function eventTypeReadiness(input: {
  eventType: HostedEventTypeValue;
  selected: boolean;
  assignments: SetupProfileAssignmentSnapshot[];
  profiles: SetupProfileSnapshot[];
  reviews: EventExperienceReviews;
}): EventTypeReadiness {
  const profile = assignedProfileForEventType(input.eventType, input.assignments, input.profiles);
  const review = input.reviews[input.eventType] ?? null;
  if (!input.selected) {
    return {
      eventType: input.eventType,
      status: "not_started",
      profile,
      review,
      reason: "not_selected",
    };
  }
  if (!profile) {
    return {
      eventType: input.eventType,
      status: "needs_review",
      profile: null,
      review,
      reason: "needs_setup",
    };
  }
  if (isEventTypeReviewValid(input)) {
    return {
      eventType: input.eventType,
      status: "ready",
      profile,
      review,
      reason: "ready",
    };
  }
  return {
    eventType: input.eventType,
    status: review ? "needs_review" : "starter_available",
    profile,
    review,
    reason: review ? "stale" : "needs_review",
  };
}

export function eventExperiencesStatus(input: {
  hostedEventTypes: string[] | null;
  assignments: SetupProfileAssignmentSnapshot[];
  profiles: SetupProfileSnapshot[];
  reviews: EventExperienceReviews;
}): SectionReadinessStatus {
  const selected = effectiveHostedEventTypes(input.hostedEventTypes);
  if (input.hostedEventTypes != null && selected.length === 0) return "in_progress";
  const cards = selected.map((eventType) =>
    eventTypeReadiness({
      eventType,
      selected: true,
      assignments: input.assignments,
      profiles: input.profiles,
      reviews: input.reviews,
    }),
  );
  if (cards.every((card) => card.status === "ready")) return "ready";
  if (cards.some((card) => card.reason === "needs_setup" || card.reason === "stale")) {
    return "needs_review";
  }
  if (cards.some((card) => card.status === "starter_available")) return "starter_available";
  return "in_progress";
}

export function makeHtcYoursSectionStatuses(input: {
  venueBrandStarted: boolean;
  yourVenueReviewedAt: string | null;
  bookingProcessReviewedAt: string | null;
  packages: PackageReadinessSnapshot[];
  contractStarterCount: number;
  hostedEventTypes: string[] | null;
  assignments: SetupProfileAssignmentSnapshot[];
  profiles: SetupProfileSnapshot[];
  reviews: EventExperienceReviews;
  communicationsReviewedAt: string | null;
  templateCount: number;
  pausedAutomationCount: number;
  operationalResourcesReviewedAt: string | null;
  operationalStarterAvailable: boolean;
}): {
  brand: SectionReadinessStatus;
  booking: SectionReadinessStatus;
  experiences: SectionReadinessStatus;
  communications: SectionReadinessStatus;
  operations: SectionReadinessStatus;
} {
  return {
    brand: venueBrandStatus({
      venueBrandStarted: input.venueBrandStarted,
      yourVenueReviewedAt: input.yourVenueReviewedAt,
    }),
    booking: bookingProcessStatus({
      bookingProcessReviewedAt: input.bookingProcessReviewedAt,
      packages: input.packages,
      contractStarterCount: input.contractStarterCount,
    }),
    experiences: eventExperiencesStatus({
      hostedEventTypes: input.hostedEventTypes,
      assignments: input.assignments,
      profiles: input.profiles,
      reviews: input.reviews,
    }),
    communications: communicationsStatus({
      communicationsReviewedAt: input.communicationsReviewedAt,
      templateCount: input.templateCount,
      pausedAutomationCount: input.pausedAutomationCount,
    }),
    operations: operationalResourcesStatus({
      operationalResourcesReviewedAt: input.operationalResourcesReviewedAt,
      starterAvailable: input.operationalStarterAvailable,
    }),
  };
}

export function makeHtcYoursMilestoneStatusFromSections(sections: {
  brand: SectionReadinessStatus;
  booking: SectionReadinessStatus;
  experiences: SectionReadinessStatus;
  communications: SectionReadinessStatus;
  operations?: SectionReadinessStatus;
}): MilestoneStatus {
  const required = [
    sections.brand,
    sections.booking,
    sections.experiences,
    sections.communications,
  ];
  if (required.every((status) => status === "ready")) return "ready";
  if (required.every((status) => status === "not_started")) return "not_started";
  return "in_progress";
}

export function canConfirmBookingProcess(packages: PackageReadinessSnapshot[]): boolean {
  return !hasUnpricedActivePackages(packages);
}

export function assignedProfileHardGaps(profile: SetupProfileSnapshot | null) {
  if (!profile) return [];
  return profileHardConfigGaps(profile.decisions ?? {}, profile.templateRefs ?? {});
}

export function experienceFamilyDisplayStatus(
  card: EventTypeReadiness,
): ExperienceFamilyDisplayStatus {
  if (card.reason === "not_selected" || card.reason === "needs_setup") return "Not started";
  const hardGaps = assignedProfileHardGaps(card.profile);
  if (card.reason === "stale" || hardGaps.length > 0) return "Needs attention";
  if (card.reason === "ready") return "Ready";
  return "In progress";
}

export function canConfirmEventTypeReview(input: {
  eventType: string;
  hostedEventTypes: string[] | null;
  assignments: SetupProfileAssignmentSnapshot[];
  profiles: SetupProfileSnapshot[];
}): { ok: true; profile: SetupProfileSnapshot } | { ok: false; message: string } {
  const selected = effectiveHostedEventTypes(input.hostedEventTypes);
  const option = hostedEventTypeOption(input.eventType);
  if (!option) return { ok: false, message: "That event type is not part of this setup." };
  if (!selected.includes(option.value)) {
    return { ok: false, message: "Choose this event type before confirming its experience." };
  }
  const profile = assignedProfileForEventType(option.value, input.assignments, input.profiles);
  if (!profile) {
    return { ok: false, message: "Assign a Setup Profile to this event type before confirming." };
  }
  const gaps = assignedProfileHardGaps(profile);
  if (gaps.length > 0) {
    return {
      ok: false,
      message:
        profileHardGapSummary(gaps) ??
        "Finish the required planning resources on this Setup Profile before marking it ready.",
    };
  }
  return { ok: true, profile };
}

export type LeadCaptureChannelKey =
  | "website_form"
  | "email_intake"
  | "tour_booking"
  | "qr_campaigns"
  | "facebook_lead_ads"
  | "manual";

export type LeadCaptureChannelState = {
  channel: LeadCaptureChannelKey;
  configuredAt: string | null;
  verifiedAt: string | null;
};

/** Whether an on-demand verify action is practical for a given channel. */
export const CHANNEL_HAS_VERIFICATION: Record<LeadCaptureChannelKey, boolean> = {
  website_form: true,
  email_intake: true,
  tour_booking: true,
  facebook_lead_ads: true,
  qr_campaigns: false, // verification is a real-world scan, not an on-demand test
  manual: false, // nothing to verify — choosing it is the whole action
};

export type OnboardingType = "self_setup" | "white_glove";

/** Explicit BYB choice when the venue has not imported data. */
export type BringYourBusinessPath = "individual" | "skipped";

/** Phase A Milestone 01 — explicit existing-bookings confirmation. */
export type ExistingBookingsAnswer = "yes" | "no";

/** Milestone card / readiness status — never Ready when required verification is unresolved. */
export type MilestoneStatus = "not_started" | "in_progress" | "ready" | "needs_attention";

export type SetupHubState = {
  venueId: string;
  onboardingType: OnboardingType;

  yourVenueReviewedAt: string | null;
  calendarAvailabilityReviewedAt: string | null;
  bringYourBusinessManualConfirmedAt: string | null;
  /** individual = add myself; skipped = not now. Imported is derived separately. */
  bringYourBusinessPath: BringYourBusinessPath | null;
  yourOfferingsReviewedAt: string | null;
  clientExperienceReviewedAt: string | null;

  leadCapturePath: "automated" | "manual_external" | null;
  leadCapturePathDecidedAt: string | null;

  yourTeamSoloConfirmedAt: string | null;
  financialsReviewedAt: string | null;

  readyToInviteCouples: boolean;
  readyToInviteCouplesAt: string | null;

  /** Phase A: first-visit welcome dismissed after Explore / Continue setup. */
  welcomeExploredAt: string | null;
  /** Phase A Milestone 01: explicit yes/no — never inferred from zero events. */
  existingBookingsAnswer: ExistingBookingsAnswer | null;
  existingBookingsAnsweredAt: string | null;
  /** Phase A Milestone 01: booking & availability rules reviewed. */
  bookingRulesReviewedAt: string | null;

  /**
   * Phase B1: event types this venue deliberately hosts in HTC.
   * Null = never selected. Independent of venues.accepted_inquiry_event_types.
   */
  hostedEventTypes: string[] | null;
  hostedEventTypesSetAt: string | null;
  /** Per event-type Setup Profile review confirmations. */
  eventExperienceReviews: Partial<Record<string, {
    profileId: string;
    profileUpdatedAt: string;
    confirmedAt: string;
    resourcesReviewedAt?: string;
  }>>;
  bookingProcessReviewedAt: string | null;
  communicationsReviewedAt: string | null;
  operationalResourcesReviewedAt: string | null;
  operationalResourceChoices: Record<string, "using" | "not_using">;
};

export type LeadCaptureStageStatus = {
  path: "automated" | "manual_external" | null;
  channels: LeadCaptureChannelState[];
  /** True once the approved completion model (plan §D) is satisfied. */
  complete: boolean;
};

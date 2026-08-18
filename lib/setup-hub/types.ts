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

export type SetupHubState = {
  venueId: string;
  onboardingType: "self_setup" | "white_glove";

  yourVenueReviewedAt: string | null;
  calendarAvailabilityReviewedAt: string | null;
  bringYourBusinessManualConfirmedAt: string | null;
  yourOfferingsReviewedAt: string | null;
  clientExperienceReviewedAt: string | null;

  leadCapturePath: "automated" | "manual_external" | null;
  leadCapturePathDecidedAt: string | null;

  yourTeamSoloConfirmedAt: string | null;
  financialsReviewedAt: string | null;

  readyToInviteCouples: boolean;
  readyToInviteCouplesAt: string | null;
};

export type LeadCaptureStageStatus = {
  path: "automated" | "manual_external" | null;
  channels: LeadCaptureChannelState[];
  /** True once the approved completion model (plan §D) is satisfied. */
  complete: boolean;
};

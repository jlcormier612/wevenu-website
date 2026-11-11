/**
 * Setup Concierge — venue-facing Phase 1 setup state.
 * Recomputed every Setup Hub load. Never persisted. Never activation stamps.
 */

import type { FacebookUiState } from "@/lib/facebook/ui-state";
import type { TextingPhase } from "@/lib/texting-registration/types";
import type { StripeOnboardingStatus } from "@/lib/venue/types";

export type SetupDomainId =
  | "profile"
  | "package"
  | "inquiry_path"
  | "website_delivery"
  | "stripe"
  | "texting"
  | "facebook";

export type SetupDomainStateKind =
  | "NOT_STARTED"
  | "WAITING_ON_VENUE"
  | "WAITING_ON_EXTERNAL"
  | "READY"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export type SetupEvidenceClass = "AUTHORITATIVE" | "OWNER_DECISION" | "EXTERNAL_UNKNOWN";

export type SetupDomainState = {
  domain: SetupDomainId;
  state: SetupDomainStateKind;
  evidenceClass: SetupEvidenceClass;
  ownerActionRequired: boolean;
  href: string | null;
  ctaLabel: string | null;
  helpHref: string | null;
  helpTitle: string | null;
  what: string;
  why: string;
  whatYouDo: string;
  whatHtcDoes: string;
  doneLooksLike: string;
  cannotSee: string | null;
};

export type SetupConciergeEntry = {
  kind: "action" | "waiting";
  domain: SetupDomainId;
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  cannotSee: string | null;
  helpHref: string | null;
  helpTitle: string | null;
};

export type VenueSetupSnapshot = {
  readyToInviteCouples: boolean;
  hasName: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  /** Active venue-authored packages (`is_active` and `source_master_key IS NULL`). Null = unknown. */
  authoredActivePackageCount: number | null;
  leadCapturePath: "automated" | "manual_external" | null;
  leadCapturePathKnown: boolean;
  inquiryFormReady: boolean;
  /** Website / website_form leads. Null = lookup failed — never treated as zero. */
  inquiryFormReceivedLead: boolean | null;
  stripeChargesEnabled: boolean;
  stripeOnboardingStatus: StripeOnboardingStatus;
  /** Owner “I’ll do this later” on Financials. */
  financialsReviewedAt: string | null;
  facebookUiState: FacebookUiState;
  textingPhase: TextingPhase;
  textingSmsReady: boolean;
  textingCanEdit: boolean;
};

export function emptyVenueSetupSnapshot(overrides: Partial<VenueSetupSnapshot> = {}): VenueSetupSnapshot {
  return {
    readyToInviteCouples: false,
    hasName: true,
    hasEmail: true,
    hasPhone: true,
    hasAddress: true,
    authoredActivePackageCount: 1,
    leadCapturePath: "manual_external",
    leadCapturePathKnown: true,
    inquiryFormReady: true,
    inquiryFormReceivedLead: false,
    stripeChargesEnabled: false,
    stripeOnboardingStatus: "not_started",
    financialsReviewedAt: "2026-01-01T00:00:00.000Z",
    facebookUiState: "not_connected",
    textingPhase: "not_started",
    textingSmsReady: false,
    textingCanEdit: true,
    ...overrides,
  };
}

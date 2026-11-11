/**
 * Pure VenueSetupState evaluation for Phase 1 Setup Concierge.
 * Dashboard venue-readiness is unchanged.
 */
import { domainCopy } from "@/lib/setup-concierge/copy";
import type {
  SetupDomainState,
  SetupDomainStateKind,
  VenueSetupSnapshot,
} from "@/lib/setup-concierge/types";

function profileReady(snapshot: VenueSetupSnapshot): boolean {
  return snapshot.hasName && (snapshot.hasEmail || snapshot.hasPhone) && snapshot.hasAddress;
}

function waitingVenue(
  domain: SetupDomainState["domain"],
  evidenceClass: SetupDomainState["evidenceClass"],
  opts?: { textingCanEdit?: boolean },
): SetupDomainState {
  return assemble(domain, "WAITING_ON_VENUE", evidenceClass, true, opts);
}

function ready(
  domain: SetupDomainState["domain"],
  evidenceClass: SetupDomainState["evidenceClass"],
): SetupDomainState {
  return assemble(domain, "READY", evidenceClass, false);
}

function notApplicable(
  domain: SetupDomainState["domain"],
  evidenceClass: SetupDomainState["evidenceClass"],
): SetupDomainState {
  return assemble(domain, "NOT_APPLICABLE", evidenceClass, false);
}

function waitingExternal(
  domain: SetupDomainState["domain"],
  evidenceClass: SetupDomainState["evidenceClass"],
): SetupDomainState {
  return assemble(domain, "WAITING_ON_EXTERNAL", evidenceClass, false);
}

function blocked(
  domain: SetupDomainState["domain"],
  evidenceClass: SetupDomainState["evidenceClass"],
  opts?: { textingCanEdit?: boolean },
): SetupDomainState {
  return assemble(domain, "BLOCKED", evidenceClass, true, opts);
}

function assemble(
  domain: SetupDomainState["domain"],
  state: SetupDomainStateKind,
  evidenceClass: SetupDomainState["evidenceClass"],
  ownerActionRequired: boolean,
  opts?: { textingCanEdit?: boolean },
): SetupDomainState {
  const copy = domainCopy(domain, state, opts);
  return {
    domain,
    state,
    evidenceClass,
    ownerActionRequired,
    ...copy,
  };
}

export function evaluateVenueSetupDomains(snapshot: VenueSetupSnapshot): SetupDomainState[] {
  const domains: SetupDomainState[] = [];

  if (profileReady(snapshot)) {
    domains.push(ready("profile", "AUTHORITATIVE"));
  } else {
    domains.push(waitingVenue("profile", "AUTHORITATIVE"));
  }

  if (snapshot.authoredActivePackageCount === null) {
    // Unknown — do not invent a package gap.
  } else if (snapshot.authoredActivePackageCount >= 1) {
    domains.push(ready("package", "AUTHORITATIVE"));
  } else {
    domains.push(waitingVenue("package", "AUTHORITATIVE"));
  }

  if (!snapshot.leadCapturePathKnown) {
    // Unknown path — do not invent an intake gap.
  } else if (snapshot.leadCapturePath === "manual_external") {
    domains.push(ready("inquiry_path", "OWNER_DECISION"));
    domains.push(notApplicable("website_delivery", "OWNER_DECISION"));
  } else if (snapshot.leadCapturePath === "automated") {
    domains.push(ready("inquiry_path", "OWNER_DECISION"));
    if (snapshot.inquiryFormReceivedLead === true) {
      domains.push(ready("website_delivery", "AUTHORITATIVE"));
    } else if (snapshot.inquiryFormReceivedLead === null) {
      // Unknown delivery — do not claim the website is missing a lead.
    } else {
      domains.push(waitingVenue("website_delivery", "AUTHORITATIVE"));
    }
  } else if (snapshot.inquiryFormReceivedLead === true) {
    domains.push(ready("inquiry_path", "AUTHORITATIVE"));
  } else if (snapshot.inquiryFormReceivedLead === false) {
    domains.push(waitingVenue("inquiry_path", "OWNER_DECISION"));
  }

  if (snapshot.stripeChargesEnabled) {
    domains.push(ready("stripe", "AUTHORITATIVE"));
  } else if (snapshot.financialsReviewedAt) {
    domains.push(notApplicable("stripe", "OWNER_DECISION"));
  } else if (snapshot.stripeOnboardingStatus === "connected" || snapshot.stripeOnboardingStatus === "pending") {
    domains.push(waitingExternal("stripe", "AUTHORITATIVE"));
  } else {
    domains.push(waitingVenue("stripe", "AUTHORITATIVE"));
  }

  const fb = snapshot.facebookUiState;
  if (fb === "not_connected") {
    // Omit — optional and never started.
  } else if (fb === "delivering") {
    domains.push(ready("facebook", "AUTHORITATIVE"));
  } else if (fb === "error") {
    domains.push(blocked("facebook", "AUTHORITATIVE"));
  } else {
    domains.push(waitingVenue("facebook", "AUTHORITATIVE"));
  }

  const texting = snapshot.textingPhase;
  if (texting === "not_started") {
    // Omit.
  } else if (texting === "ready" && snapshot.textingSmsReady) {
    domains.push(ready("texting", "AUTHORITATIVE"));
  } else if (texting === "needs_attention" || texting === "failed" || texting === "paused") {
    domains.push(blocked("texting", "AUTHORITATIVE", { textingCanEdit: snapshot.textingCanEdit }));
  } else if (
    texting === "information_saved"
    || texting === "under_review"
    || texting === "setting_up_number"
    || (texting === "ready" && !snapshot.textingSmsReady)
  ) {
    domains.push(waitingExternal("texting", "AUTHORITATIVE"));
  } else {
    domains.push(waitingVenue("texting", "AUTHORITATIVE"));
  }

  return domains;
}

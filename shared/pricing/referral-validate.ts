/**
 * Phase 6 — Referral submission validation and identity helpers.
 */

import type {
  CustomerReferralStatus,
  ReferralRewardStatus,
  ReferralWorkflowStatus,
  VenueReferralRecord,
} from "./referral-types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type ReferralSubmissionInput = {
  venueName: string;
  city: string;
  state: string;
  website: string;
  contactEmail: string;
  contactName: string;
  contactRole?: string | null;
  notes?: string | null;
};

export type ReferralFieldErrors = Partial<
  Record<keyof ReferralSubmissionInput, string>
>;

export function normalizeWebsite(raw: string): string {
  let value = raw.trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    const url = new URL(value);
    if (!url.hostname || !url.hostname.includes(".")) return "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function extractWebsiteDomain(website: string): string | null {
  const normalized = normalizeWebsite(website);
  if (!normalized) return null;
  try {
    const host = new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isLikelyBusinessEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized)) return false;
  // Reject obvious form-handler style paths pasted as "email"
  if (normalized.includes("/") || normalized.includes(" ")) return false;
  return true;
}

export function validateReferralSubmission(
  input: ReferralSubmissionInput,
): { ok: true; cleaned: Required<ReferralSubmissionInput> } | {
  ok: false;
  errors: ReferralFieldErrors;
  message: string;
} {
  const errors: ReferralFieldErrors = {};
  const venueName = input.venueName?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim() ?? "";
  const websiteRaw = input.website?.trim() ?? "";
  const contactEmail = normalizeEmail(input.contactEmail ?? "");
  const contactName = input.contactName?.trim() ?? "";
  const contactRole = input.contactRole?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!venueName) errors.venueName = "Please enter the venue name.";
  if (!city) errors.city = "Please enter the city.";
  if (!state) errors.state = "Please enter the state.";
  if (state && state.length > 64) errors.state = "State looks too long.";

  const website = normalizeWebsite(websiteRaw);
  if (!websiteRaw) {
    errors.website = "Please enter the venue website.";
  } else if (!website) {
    errors.website = "Please enter a valid website URL (for example, https://example.com).";
  }

  if (!contactName) errors.contactName = "Please enter a contact name.";
  if (!contactEmail) {
    errors.contactEmail = "Please enter a business contact email.";
  } else if (!isLikelyBusinessEmail(contactEmail)) {
    errors.contactEmail =
      "Please enter a real business email address (not a website form URL).";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: "Please fix the highlighted fields and try again.",
    };
  }

  return {
    ok: true,
    cleaned: {
      venueName,
      city,
      state,
      website,
      contactEmail,
      contactName,
      contactRole,
      notes,
    },
  };
}

export function mapCustomerReferralStatus(input: {
  workflowStatus: ReferralWorkflowStatus;
  rewardStatus?: ReferralRewardStatus | null;
}): CustomerReferralStatus {
  if (input.rewardStatus === "applied") return "credit_applied";
  if (
    input.rewardStatus === "issued" ||
    input.rewardStatus === "issuing" ||
    input.workflowStatus === "reward_issued"
  ) {
    return "credit_earned";
  }
  if (
    input.rewardStatus === "eligible" ||
    input.rewardStatus === "approved" ||
    input.workflowStatus === "reward_eligible"
  ) {
    return "credit_pending";
  }
  if (
    input.workflowStatus === "converted" ||
    input.workflowStatus === "qualification_pending"
  ) {
    return "venue_joined";
  }
  if (
    input.workflowStatus === "under_review" ||
    input.workflowStatus === "contacted" ||
    input.workflowStatus === "interested"
  ) {
    return "reviewing";
  }
  if (
    input.workflowStatus === "closed_not_eligible" ||
    input.workflowStatus === "closed_duplicate" ||
    input.workflowStatus === "closed_declined"
  ) {
    return "closed";
  }
  return "referral_received";
}

export function customerStatusLabel(status: CustomerReferralStatus): string {
  switch (status) {
    case "referral_received":
      return "Referral received";
    case "reviewing":
      return "We're reviewing it";
    case "venue_joined":
      return "Venue joined HTC";
    case "credit_pending":
      return "Thank-you credit pending";
    case "credit_earned":
      return "Credit earned";
    case "credit_applied":
      return "Credit applied";
    case "closed":
      return "Closed";
  }
}

/** Strip founder-only fields before returning to venue users. */
export function toCustomerReferralView(
  referral: VenueReferralRecord,
  reward?: {
    status: ReferralRewardStatus;
    rewardAmountCents: number | null;
    currency: string | null;
    appliedInvoiceId: string | null;
    issuedAt: string | null;
    appliedAt: string | null;
  } | null,
) {
  const customerStatus = mapCustomerReferralStatus({
    workflowStatus: referral.status,
    rewardStatus: reward?.status ?? null,
  });
  const showAmount =
    reward != null &&
    ["eligible", "approved", "issuing", "issued", "applied"].includes(
      reward.status,
    );

  return {
    id: referral.id,
    referredVenueName: referral.referredVenueName,
    referredCity: referral.referredCity,
    referredState: referral.referredState,
    submittedAt: referral.createdAt,
    status: customerStatus,
    statusLabel: customerStatusLabel(customerStatus),
    rewardAmountCents: showAmount ? reward?.rewardAmountCents ?? null : null,
    rewardCurrency: showAmount ? reward?.currency ?? "usd" : null,
    appliedInvoiceId:
      reward?.status === "applied" ? reward.appliedInvoiceId : null,
    issuedAt: reward?.issuedAt ?? null,
    appliedAt: reward?.appliedAt ?? null,
  };
}

export function domainsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase().replace(/^www\./, "") === b.toLowerCase().replace(/^www\./, "");
}

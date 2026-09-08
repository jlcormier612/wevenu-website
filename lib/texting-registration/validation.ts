/**
 * Validation + progressive “what’s still missing” for texting registration.
 * Does not invent legal defaults.
 */
import type { TextingRegistrationInput, TextingRegistrationView } from "@/lib/texting-registration/types";
import { normalizeRegistrationNumber } from "@/lib/texting-registration/sensitive-field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TextingFieldKey = keyof TextingRegistrationInput;

export type TextingMissingGroup = "business" | "compliance" | "messaging";

export type TextingValidationResult = {
  ok: boolean;
  errors: Partial<Record<TextingFieldKey, string>>;
  missing: TextingFieldKey[];
  missingGroups: TextingMissingGroup[];
};

function trim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Merge persisted view + optional draft into a flat input for validation. */
export function toTextingInput(
  view: TextingRegistrationView | null,
  draft?: Partial<TextingRegistrationInput>,
): TextingRegistrationInput {
  return {
    businessName: draft?.businessName ?? view?.businessName ?? "",
    websiteUrl: draft?.websiteUrl ?? view?.websiteUrl ?? "",
    addressLine1: draft?.addressLine1 ?? view?.addressLine1 ?? "",
    addressLine2: draft?.addressLine2 ?? view?.addressLine2 ?? "",
    city: draft?.city ?? view?.city ?? "",
    stateRegion: draft?.stateRegion ?? view?.stateRegion ?? "",
    postalCode: draft?.postalCode ?? view?.postalCode ?? "",
    country: draft?.country ?? view?.country ?? "",
    contactEmail: draft?.contactEmail ?? view?.contactEmail ?? "",
    contactPhone: draft?.contactPhone ?? view?.contactPhone ?? "",
    businessType: draft?.businessType ?? view?.businessType ?? "",
    businessIndustry: draft?.businessIndustry ?? view?.businessIndustry ?? "",
    registrationIdType: draft?.registrationIdType ?? view?.registrationIdType ?? "",
    registrationNumber: draft?.registrationNumber ?? "",
    regionsOfOperation: draft?.regionsOfOperation
      ?? view?.regionsOfOperation
      ?? "",
    repFirstName: draft?.repFirstName ?? view?.repFirstName ?? "",
    repLastName: draft?.repLastName ?? view?.repLastName ?? "",
    repEmail: draft?.repEmail ?? view?.repEmail ?? "",
    repPhone: draft?.repPhone ?? view?.repPhone ?? "",
    repBusinessTitle: draft?.repBusinessTitle ?? view?.repBusinessTitle ?? "",
    repJobPosition: draft?.repJobPosition ?? view?.repJobPosition ?? "",
    messagingPurpose: draft?.messagingPurpose ?? view?.messagingPurpose ?? "",
    sampleMessage1: draft?.sampleMessage1 ?? view?.sampleMessage1 ?? "",
    sampleMessage2: draft?.sampleMessage2 ?? view?.sampleMessage2 ?? "",
    optInDescription: draft?.optInDescription ?? view?.optInDescription ?? "",
    privacyPolicyUrl: draft?.privacyPolicyUrl ?? view?.privacyPolicyUrl ?? "",
    termsUrl: draft?.termsUrl ?? view?.termsUrl ?? "",
  };
}

export function validateTextingRegistration(
  input: TextingRegistrationInput,
  opts?: { hasExistingRegistrationNumber?: boolean },
): TextingValidationResult {
  const errors: Partial<Record<TextingFieldKey, string>> = {};
  const missing: TextingFieldKey[] = [];

  function requireField(key: TextingFieldKey, label: string, value: string) {
    if (!trim(value)) {
      errors[key] = `Add ${label}.`;
      missing.push(key);
    }
  }

  requireField("businessName", "your legal business name", input.businessName);
  requireField("websiteUrl", "your website", input.websiteUrl);
  if (trim(input.websiteUrl) && !isHttpUrl(trim(input.websiteUrl))) {
    errors.websiteUrl = "Enter a valid website URL (https://…).";
  }
  requireField("addressLine1", "street address", input.addressLine1);
  requireField("city", "city", input.city);
  requireField("stateRegion", "state", input.stateRegion);
  requireField("postalCode", "postal code", input.postalCode);
  requireField("country", "country", input.country);
  requireField("contactEmail", "contact email", input.contactEmail);
  if (trim(input.contactEmail) && !EMAIL_RE.test(trim(input.contactEmail))) {
    errors.contactEmail = "Enter a valid email address.";
  }
  requireField("contactPhone", "contact phone", input.contactPhone);

  requireField("businessType", "business type", input.businessType);
  requireField("businessIndustry", "industry", input.businessIndustry);
  requireField("registrationIdType", "registration ID type", input.registrationIdType);
  requireField("regionsOfOperation", "where you operate", input.regionsOfOperation);

  const digits = normalizeRegistrationNumber(input.registrationNumber);
  const hasNumber = digits.length > 0 || !!opts?.hasExistingRegistrationNumber;
  if (!hasNumber) {
    errors.registrationNumber = "Add your business registration number.";
    missing.push("registrationNumber");
  } else if (digits.length > 0 && digits.length < 8) {
    errors.registrationNumber = "That registration number looks too short.";
  }

  requireField("repFirstName", "authorized representative first name", input.repFirstName);
  requireField("repLastName", "authorized representative last name", input.repLastName);
  requireField("repEmail", "authorized representative email", input.repEmail);
  if (trim(input.repEmail) && !EMAIL_RE.test(trim(input.repEmail))) {
    errors.repEmail = "Enter a valid email address.";
  }
  requireField("repPhone", "authorized representative phone", input.repPhone);
  requireField("repBusinessTitle", "title", input.repBusinessTitle);
  requireField("repJobPosition", "role", input.repJobPosition);

  requireField("messagingPurpose", "what you’ll text about", input.messagingPurpose);
  requireField("sampleMessage1", "a sample text message", input.sampleMessage1);
  requireField("optInDescription", "how people opt in to texts", input.optInDescription);
  requireField("privacyPolicyUrl", "privacy policy URL", input.privacyPolicyUrl);
  requireField("termsUrl", "terms of service URL", input.termsUrl);
  if (trim(input.privacyPolicyUrl) && !isHttpUrl(trim(input.privacyPolicyUrl))) {
    errors.privacyPolicyUrl = "Enter a valid privacy policy URL.";
  }
  if (trim(input.termsUrl) && !isHttpUrl(trim(input.termsUrl))) {
    errors.termsUrl = "Enter a valid terms URL.";
  }

  const missingGroups: TextingMissingGroup[] = [];
  const businessKeys: TextingFieldKey[] = [
    "businessName", "websiteUrl", "addressLine1", "city", "stateRegion",
    "postalCode", "country", "contactEmail", "contactPhone",
  ];
  const complianceKeys: TextingFieldKey[] = [
    "businessType", "businessIndustry", "registrationIdType", "registrationNumber",
    "regionsOfOperation",
    "repFirstName", "repLastName", "repEmail", "repPhone", "repBusinessTitle", "repJobPosition",
  ];
  const messagingKeys: TextingFieldKey[] = [
    "messagingPurpose", "sampleMessage1", "optInDescription", "privacyPolicyUrl", "termsUrl",
  ];
  if (missing.some((k) => businessKeys.includes(k)) || errors.websiteUrl || errors.contactEmail) {
    missingGroups.push("business");
  }
  if (missing.some((k) => complianceKeys.includes(k)) || errors.registrationNumber || errors.repEmail) {
    missingGroups.push("compliance");
  }
  if (missing.some((k) => messagingKeys.includes(k)) || errors.privacyPolicyUrl || errors.termsUrl) {
    missingGroups.push("messaging");
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    missing,
    missingGroups,
  };
}

/** Business identity complete enough to skip “confirm” emphasis. */
export function isBusinessIdentityComplete(input: TextingRegistrationInput): boolean {
  return !!(
    trim(input.businessName)
    && trim(input.websiteUrl)
    && isHttpUrl(trim(input.websiteUrl))
    && trim(input.addressLine1)
    && trim(input.city)
    && trim(input.stateRegion)
    && trim(input.postalCode)
    && trim(input.country)
    && trim(input.contactEmail)
    && EMAIL_RE.test(trim(input.contactEmail))
    && trim(input.contactPhone)
  );
}

export function isComplianceComplete(
  input: TextingRegistrationInput,
  hasExistingRegistrationNumber: boolean,
): boolean {
  const v = validateTextingRegistration(input, { hasExistingRegistrationNumber });
  return !v.missingGroups.includes("compliance")
    && !v.errors.registrationNumber
    && !v.errors.repEmail;
}

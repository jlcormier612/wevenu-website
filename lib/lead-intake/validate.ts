import type { NormalizedLeadInput, ValidationResult } from "@/lib/lead-intake/types";

/**
 * Shared Validate stage — separate from Normalize on purpose. Only checks
 * what's universally required; source-specific requirements (e.g. an email
 * being mandatory for a form but not for a phone-taken lead) stay a Source
 * Adapter's own concern, decided before this ever runs.
 */
export function validateLeadInput(input: NormalizedLeadInput): ValidationResult {
  if (!input.firstName || !input.lastName) {
    return { ok: false, error: "First and last name are required." };
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { ok: false, error: "Email address is not valid." };
  }
  return { ok: true };
}

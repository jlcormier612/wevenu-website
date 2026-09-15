/**
 * Shared client/server rules for the venue-owner activate (password + legal) form.
 * Keep messages and the 8-character minimum aligned with
 * `workspace/app/activate/actions.ts` and the enrollment activate API.
 */

export const ACTIVATE_PASSWORD_MIN_LENGTH = 8;

export const ACTIVATE_TOKEN_ERROR =
  "This activation link is invalid or has already been used.";
export const ACTIVATE_LEGAL_ERROR =
  "Please agree to the Terms of Service and Privacy Policy to continue.";
export const ACTIVATE_PASSWORD_LENGTH_ERROR =
  "Password must be at least 8 characters.";
export const ACTIVATE_PASSWORD_MISMATCH_ERROR = "Passwords do not match.";

export type ActivateAccountFieldState = {
  password: string;
  confirm: string;
  legalAccepted: boolean;
  pending?: boolean;
};

export type ActivateAccountFieldsResult =
  | { ok: true }
  | { ok: false; error: string };

export function isActivateLegalAccepted(
  value: FormDataEntryValue | null,
): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "true" || raw === "on" || raw === "1";
}

export function parseActivateAccountFormData(formData: FormData): {
  token: string;
  email: string;
  password: string;
  confirm: string;
  relationshipId: string;
  legalAccepted: boolean;
} {
  return {
    token: String(formData.get("token") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
    confirm: String(formData.get("confirm") || ""),
    relationshipId: String(formData.get("relationshipId") || "").trim(),
    legalAccepted: isActivateLegalAccepted(formData.get("legalAccepted")),
  };
}

export function validateActivateAccountFields(
  input: Pick<ActivateAccountFieldState, "password" | "confirm" | "legalAccepted">,
): ActivateAccountFieldsResult {
  if (!input.legalAccepted) {
    return { ok: false, error: ACTIVATE_LEGAL_ERROR };
  }
  if (input.password.length < ACTIVATE_PASSWORD_MIN_LENGTH) {
    return { ok: false, error: ACTIVATE_PASSWORD_LENGTH_ERROR };
  }
  if (input.password !== input.confirm) {
    return { ok: false, error: ACTIVATE_PASSWORD_MISMATCH_ERROR };
  }
  return { ok: true };
}

/** Client enablement for Let's go — same field rules as the server action. */
export function canSubmitActivateAccount(
  input: ActivateAccountFieldState,
): boolean {
  if (input.pending) return false;
  return validateActivateAccountFields(input).ok;
}

/**
 * Field/token gate used by `activateAccountAction` before legal write +
 * `activateVenueAccount`. Invalid payloads never reach account creation.
 */
export function gateActivateAccountSubmission(formData: FormData):
  | {
      ok: true;
      token: string;
      email: string;
      password: string;
      relationshipId: string;
    }
  | { ok: false; error: string } {
  const parsed = parseActivateAccountFormData(formData);
  if (!parsed.token) {
    return { ok: false, error: ACTIVATE_TOKEN_ERROR };
  }
  const fields = validateActivateAccountFields(parsed);
  if (!fields.ok) {
    return { ok: false, error: fields.error };
  }
  return {
    ok: true,
    token: parsed.token,
    email: parsed.email,
    password: parsed.password,
    relationshipId: parsed.relationshipId,
  };
}

export function activatePasswordInputType(
  revealed: boolean,
): "text" | "password" {
  return revealed ? "text" : "password";
}

export function activatePasswordToggleLabel(
  revealed: boolean,
  field: "password" | "confirm",
): string {
  if (field === "confirm") {
    return revealed ? "Hide confirm password" : "Show confirm password";
  }
  return revealed ? "Hide password" : "Show password";
}

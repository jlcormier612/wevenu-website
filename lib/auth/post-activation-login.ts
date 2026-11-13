/**
 * Post-purchase activation lands on product `/login?activated=1`.
 * A prior venue session in the same browser must never silently win —
 * that is how Meadowbrook activation left a Jennifer Fancy session active
 * while the purchaser handoff stayed unconsumed.
 *
 * Email on the URL is prefill / mismatch messaging only — never authorization.
 */
import { safeLoginEmailPrefill } from "@/lib/auth/login-email-prefill";

export function isPostActivationLogin(searchParams: URLSearchParams): boolean {
  return searchParams.get("activated") === "1";
}

/** Clear any existing venue session before showing post-activation login. */
export function mustClearVenueSessionForPostActivationLogin(
  searchParams: URLSearchParams,
  hasVenueSession: boolean,
): boolean {
  return isPostActivationLogin(searchParams) && hasVenueSession;
}

export function postActivationLoginEmailPrefill(
  searchParams: URLSearchParams,
): string | undefined {
  return safeLoginEmailPrefill(searchParams.get("email"));
}

/**
 * When a session remains (e.g. client-side path) and email is present,
 * surface explicit account-switch copy. Never treats email as proof of identity.
 */
export function isWrongAccountForPostActivation(input: {
  sessionEmail: string | null | undefined;
  intendedEmail: string | null | undefined;
}): boolean {
  const session = (input.sessionEmail ?? "").trim().toLowerCase();
  const intended = (input.intendedEmail ?? "").trim().toLowerCase();
  if (!session || !intended) return false;
  return session !== intended;
}

/**
 * Soft recovery copy when post-activation login fails with invalid credentials.
 * Common cause: the purchaser left the activate page early (or opened login in
 * another tab) before activateVenueAccount finished writing the password.
 */
export const POST_ACTIVATION_INVALID_CREDENTIALS_HINT =
  "If you just created your password, wait a few seconds and try again — account setup may still be finishing. Stay on the activation page until it redirects you next time.";

export function postActivationInvalidCredentialsMessage(
  errorMessage: string,
  justActivated: boolean,
): string {
  const trimmed = errorMessage.trim();
  if (!justActivated || !/invalid login credentials/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} ${POST_ACTIVATION_INVALID_CREDENTIALS_HINT}`;
}

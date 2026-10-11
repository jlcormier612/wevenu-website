"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import {
  PASSWORD_RECOVERY_SUCCESS_COPY,
  loginPathForAudience,
  safePasswordRecoveryAudience,
  validateNewPassword,
} from "@/lib/auth/password-recovery";
import { sendBrandedPasswordRecoveryEmail } from "@/lib/auth/send-password-recovery-email";
import { safeInternalNextPath } from "@/lib/auth/portal-home";
import { resolveAuthenticatedHomePath } from "@/lib/auth/resolve-home";
import { isSupabaseConfigured } from "@/lib/env";

export type AuthFormState = {
  error?: string;
  /**
   * Where the browser should go after a successful sign-in.
   *
   * This is returned to the client instead of being handled by `redirect()`
   * because the venue workspace layout runs its own gates (ownership, intake,
   * graduation, suspension) and redirects again. A `redirect()` from inside a
   * Server Action whose destination redirects a second time leaves the App
   * Router unable to reconcile the tree: it refetches the destination RSC
   * payload forever — each response a valid 200 — and the customer is left on
   * a permanently blank page. A full-document navigation turns that second
   * gate back into an ordinary HTTP redirect, which works.
   *
   * It also guarantees every layout sees the freshly written session cookie.
   */
  redirectTo?: string;
  /** Generic password-reset request acknowledgement (never reveals account existence). */
  success?: string;
};

/**
 * Authenticates a user with email + password via Supabase Auth and redirects to
 * the workspace on success.
 *
 * When Supabase is not configured (expected in local dev before infrastructure
 * is provisioned), a clear, non-fatal error is returned instead of crashing.
 */
export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeInternalNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (!isSupabaseConfigured) {
    return {
      error:
        "Authentication is not configured in this environment. Supabase " +
        "credentials are required to sign in.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Hard-lock: suspended / unpaid venues may not enter the workspace.
  // Keep the session so /billing/suspended can open the Stripe Billing Portal.
  const { data: venueLock } = await supabase
    .from("venues")
    .select("access_disabled, account_status")
    .maybeSingle<{
      access_disabled: boolean | null;
      account_status: string | null;
    }>();

  if (
    venueLock &&
    (venueLock.access_disabled === true ||
      venueLock.account_status === "suspended")
  ) {
    return { redirectTo: "/billing/suspended" };
  }

  // Prefer ?next= (e.g. /vendor/accept?token=…) so invitation claimers return
  // to the claim page after signing in. Multi-role → /workspaces chooser.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { redirectTo: "/login" };
  }

  return {
    redirectTo: await resolveAuthenticatedHomePath(supabase, user.id, { next }),
  };
}

/**
 * Signs the current venue user out (venue cookie jar only) and returns them
 * to the venue login screen. Vendor/client sessions in this browser are kept.
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient("venue");
    await supabase.auth.signOut();
  }
  redirect("/login");
}

/**
 * Request a venue password-reset email. Always returns the same success copy
 * whether or not the address has an account (no enumeration).
 */
export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const audience = safePasswordRecoveryAudience(formData.get("audience"));
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  if (!isSupabaseConfigured) {
    return {
      error:
        "Authentication is not configured in this environment. Supabase " +
        "credentials are required to reset a password.",
    };
  }

  // Branded delivery: Supabase Admin generateLink (secure recovery URL) + Resend
  // with HTC From/template. Avoids Supabase Auth's default mailer branding.
  // Enumeration-safe: unknown emails still get the same success copy.
  const result = await sendBrandedPasswordRecoveryEmail({ email, audience });
  if (result.ok || result.reason === "no_user") {
    return { success: PASSWORD_RECOVERY_SUCCESS_COPY };
  }
  if (result.reason === "not_configured") {
    return {
      error:
        "Password reset email is not configured in this environment. Please try again later.",
    };
  }
  return {
    error: "We couldn’t start a password reset right now. Please try again shortly.",
  };
}

/**
 * Set a new password after the recovery link established a venue session.
 * Signs out afterward so the user signs in with the new credentials.
 */
export async function updatePasswordAfterRecovery(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const audience = safePasswordRecoveryAudience(formData.get("audience"));
  const validationError = validateNewPassword(password, confirm);
  if (validationError) return { error: validationError };

  if (!isSupabaseConfigured) {
    return {
      error:
        "Authentication is not configured in this environment. Supabase " +
        "credentials are required to reset a password.",
    };
  }

  const supabase = await createClient(audience);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();
  // Hard redirect — do not return redirectTo and re-render /reset-password
  // after signOut (that RSC pass has no session and bounces to invalid_link).
  redirect(`${loginPathForAudience(audience)}?reset=1`);
}

/**
 * Signed-in venue or vendor: update password on the current scoped session.
 * Keeps the session; does not require the current password.
 * Client portal uses `changeMyPassword` / Account settings instead.
 */
export async function changePasswordWhileSignedIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const audienceRaw = String(formData.get("audience") ?? "venue");
  const scope = audienceRaw === "vendor" ? "vendor" : "venue";
  const validationError = validateNewPassword(password, confirm);
  if (validationError) return { error: validationError };

  if (!isSupabaseConfigured) {
    return {
      error:
        "Authentication is not configured in this environment. Supabase " +
        "credentials are required to change a password.",
    };
  }

  const supabase = await createClient(scope);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Sign in again, then try changing your password." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("session") || msg.includes("jwt") || msg.includes("auth")) {
      return { error: "Your session expired. Sign in again, then try changing your password." };
    }
    return { error: error.message };
  }

  return { success: "Your password was updated." };
}

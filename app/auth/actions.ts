"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import {
  PASSWORD_RECOVERY_SUCCESS_COPY,
  passwordRecoveryRedirectTo,
  validateNewPassword,
} from "@/lib/auth/password-recovery";
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

  const supabase = await createClient();
  // Do not log redirect URLs that may later contain codes; only the fixed path is used.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: passwordRecoveryRedirectTo(),
  });

  // Rate-limit / misconfiguration surfaces as a real error; unknown emails do not.
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate") || msg.includes("security purposes")) {
      return {
        error: "Please wait a moment before requesting another reset email.",
      };
    }
    // Still return generic success for most provider failures that would
    // otherwise leak whether the address is registered.
    if (msg.includes("user not found") || msg.includes("unable to find")) {
      return { success: PASSWORD_RECOVERY_SUCCESS_COPY };
    }
    return {
      error: "We couldn’t start a password reset right now. Please try again shortly.",
    };
  }

  return { success: PASSWORD_RECOVERY_SUCCESS_COPY };
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
  const validationError = validateNewPassword(password, confirm);
  if (validationError) return { error: validationError };

  if (!isSupabaseConfigured) {
    return {
      error:
        "Authentication is not configured in this environment. Supabase " +
        "credentials are required to reset a password.",
    };
  }

  const supabase = await createClient();
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
  return { redirectTo: "/login?reset=1" };
}

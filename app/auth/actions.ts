"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import { safeInternalNextPath } from "@/lib/auth/portal-home";
import { resolveAuthenticatedHomePath } from "@/lib/auth/resolve-home";
import { isSupabaseConfigured } from "@/lib/env";

export type AuthFormState = {
  error?: string;
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
    redirect("/billing/suspended");
  }

  // Prefer ?next= (e.g. /vendor/accept?token=…) so invitation claimers return
  // to the claim page after signing in. Multi-role → /workspaces chooser.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  redirect(
    await resolveAuthenticatedHomePath(supabase, user.id, { next }),
  );
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

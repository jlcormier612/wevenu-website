"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
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

  // redirect() throws internally and must be outside the try/catch above.
  redirect("/dashboard");
}

/**
 * Signs the current user out and returns them to the login screen.
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

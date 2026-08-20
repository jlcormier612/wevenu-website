"use server";

import { redirect } from "next/navigation";

import {
  createClient,
  createClientPortalAuthClient,
  createVendorClient,
} from "@/integrations/supabase/server";
import { safeInternalNextPath } from "@/lib/auth/portal-home";
import { isSupabaseConfigured } from "@/lib/env";

export type AuthFormState = { error?: string };

/**
 * Sign out of one portal cookie jar only. Other portal sessions in this
 * browser stay intact.
 */
export async function signOutVenue(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient("venue");
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function signOutVendor(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createVendorClient();
    await supabase.auth.signOut();
  }
  redirect("/vendor/login");
}

export async function signOutClientPortal(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClientPortalAuthClient();
    await supabase.auth.signOut();
  }
  redirect("/client/login");
}

/**
 * Sign out a mismatched invite session and return to an accept URL without
 * clearing unrelated portal cookies when possible.
 *
 * For vendor accept: clears vendor jar only.
 * For client accept: clears client jar only.
 * Fallback: clears venue jar (legacy callers).
 */
export async function switchAccountForInviteAction(
  returnTo: string,
): Promise<void> {
  const next = safeInternalNextPath(returnTo) ?? "/login";
  if (!isSupabaseConfigured) redirect(next);

  if (next.startsWith("/vendor/")) {
    const supabase = await createVendorClient();
    await supabase.auth.signOut();
  } else if (next.startsWith("/client/")) {
    const supabase = await createClientPortalAuthClient();
    await supabase.auth.signOut();
  } else {
    const supabase = await createClient("venue");
    await supabase.auth.signOut();
  }
  redirect(next);
}

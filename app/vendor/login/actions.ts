"use server";

import { redirect } from "next/navigation";

import { createVendorClient } from "@/integrations/supabase/server";
import { safeInternalNextPath } from "@/lib/auth/portal-home";
import { isSupabaseConfigured } from "@/lib/env";

export type VendorAuthFormState = { error?: string };

/**
 * Vendor portal sign-in — writes only the vendor auth cookie jar so a venue
 * session in the same browser is preserved.
 */
export async function signInVendor(
  _prevState: VendorAuthFormState,
  formData: FormData,
): Promise<VendorAuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next =
    safeInternalNextPath(formData.get("next")) ?? "/vendor/dashboard";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (!isSupabaseConfigured) {
    return { error: "Authentication is not configured in this environment." };
  }

  const supabase = await createVendorClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign-in failed. Please try again." };

  const { data: vu } = await supabase
    .from("vendor_users")
    .select("vendor_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!vu) {
    // Signed in but not linked to a vendor profile yet — send to accept if
    // that was the destination, otherwise explain.
    if (next.startsWith("/vendor/accept")) {
      redirect(next);
    }
    return {
      error:
        "This account is not linked to a vendor profile yet. Open your invitation link to claim one.",
    };
  }

  redirect(next.startsWith("/vendor") ? next : "/vendor/dashboard");
}

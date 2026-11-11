"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import { safeLoginEmailPrefill } from "@/lib/auth/login-email-prefill";
import { isSupabaseConfigured } from "@/lib/env";

export async function signOutToAcceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/login");
  if (isSupabaseConfigured) {
    const supabase = await createClient("venue");
    await supabase.auth.signOut();
  }
  const invitedEmail = safeLoginEmailPrefill(formData.get("invitedEmail"));
  const login = new URLSearchParams();
  login.set("next", `/join?token=${token}`);
  if (invitedEmail) login.set("email", invitedEmail);
  redirect(`/login?${login.toString()}`);
}

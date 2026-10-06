"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function signOutToAcceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/login");
  if (isSupabaseConfigured) {
    const supabase = await createClient("venue");
    await supabase.auth.signOut();
  }
  redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
}

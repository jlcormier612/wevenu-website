import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthBrandShell } from "@/components/auth/auth-brand-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured) {
    redirect("/forgot-password?error=not_configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password?error=invalid_link");
  }

  return (
    <AuthBrandShell
      title="Choose a new password"
      description="Enter a new password for your Hello to Cheers workspace, then sign in with it."
    >
      <ResetPasswordForm />
    </AuthBrandShell>
  );
}

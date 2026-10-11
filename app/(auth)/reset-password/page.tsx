import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthBrandShell } from "@/components/auth/auth-brand-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/integrations/supabase/server";
import { safePasswordRecoveryAudience } from "@/lib/auth/password-recovery";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Choose a new password",
};

type Props = {
  searchParams: Promise<{ audience?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { audience: audienceRaw } = await searchParams;
  const audience = safePasswordRecoveryAudience(audienceRaw);

  if (!isSupabaseConfigured) {
    redirect(`/forgot-password?error=not_configured&audience=${encodeURIComponent(audience)}`);
  }

  const supabase = await createClient(audience);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/forgot-password?error=invalid_link&audience=${encodeURIComponent(audience)}`);
  }

  return (
    <AuthBrandShell
      title="Choose a new password"
      description="Enter a new password for your Hello to Cheers workspace, then sign in with it."
    >
      <ResetPasswordForm audience={audience} />
    </AuthBrandShell>
  );
}

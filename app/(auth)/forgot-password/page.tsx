import type { Metadata } from "next";

import { AuthBrandShell } from "@/components/auth/auth-brand-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { safeLoginEmailPrefill } from "@/lib/auth/login-email-prefill";
import { safePasswordRecoveryAudience } from "@/lib/auth/password-recovery";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Forgot password",
};

type Props = {
  searchParams: Promise<{ email?: string; error?: string; audience?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { email, error, audience: audienceRaw } = await searchParams;
  const audience = safePasswordRecoveryAudience(audienceRaw);
  const defaultEmail = safeLoginEmailPrefill(email);
  const errorCopy =
    error === "invalid_link"
      ? "That reset link is invalid or has expired. Enter your email to request a new one."
      : error === "not_configured"
        ? "Password reset is not available in this environment."
        : null;

  return (
    <AuthBrandShell
      title="Reset your password"
      description="Enter the email for your Hello to Cheers workspace. We’ll send a link if an account exists."
      footer={
        !isSupabaseConfigured ? (
          <p className="text-center text-xs text-muted-foreground">
            Authentication backend is not configured in this environment.
          </p>
        ) : null
      }
    >
      {errorCopy ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-foreground"
        >
          {errorCopy}
        </p>
      ) : null}
      <ForgotPasswordForm defaultEmail={defaultEmail} audience={audience} />
    </AuthBrandShell>
  );
}

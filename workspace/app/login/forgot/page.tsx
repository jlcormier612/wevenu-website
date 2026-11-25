import Link from "next/link";

import { ActivationBrandMark } from "@/components/activate/activation-brand-mark";
import { ForgotPasswordForm } from "@/components/team/forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="ws-login-shell flex min-h-screen items-center justify-center px-6 py-10">
      <div className="ws-panel w-full max-w-md p-8 shadow-[0_10px_28px_rgba(41,45,41,0.08)] md:p-10">
        <ActivationBrandMark />
        <h1 className="mt-6 font-heading text-[2.125rem] tracking-tight text-[var(--htc-forest)] md:text-4xl">
          Reset password
        </h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">
          Enter your team email. If you have Workspace access, we will send a
          reset link.
        </p>
        <ForgotPasswordForm />
        <p className="mt-4 text-center text-sm ws-muted">
          <Link
            href="/login"
            className="text-[var(--htc-primary)] underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

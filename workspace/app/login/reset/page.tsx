import { ActivationBrandMark } from "@/components/activate/activation-brand-mark";
import { ResetPasswordForm } from "@/components/team/reset-password-form";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="ws-login-shell flex min-h-screen items-center justify-center px-6 py-10">
      <div className="ws-panel w-full max-w-md p-8 shadow-[0_10px_28px_rgba(41,45,41,0.08)] md:p-10">
        <ActivationBrandMark />
        <h1 className="mt-6 font-heading text-[2.125rem] tracking-tight text-[var(--htc-forest)] md:text-4xl">
          Choose a new password
        </h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">
          Enter a new password for the Relationship Workspace, then sign in
          with it.
        </p>
        <ResetPasswordForm />
      </div>
    </div>
  );
}

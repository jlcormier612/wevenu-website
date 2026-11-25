"use client";

import { useActionState } from "react";
import Link from "next/link";

import { requestPasswordResetAction } from "@/app/(app)/team/auth-actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      {state?.error ? (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p
          role="status"
          className="rounded-sm border border-[color-mix(in_srgb,var(--soft-sage)_70%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_25%,transparent)] px-3 py-2 text-sm text-foreground"
        >
          If an account exists for that email, we sent password reset instructions.
          Check your inbox.
        </p>
      ) : null}
      <label className="block">
        <span className="ws-eyebrow">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={Boolean(state?.ok)}
          className="ws-control mt-2 w-full px-3 py-2.5 text-sm outline-none focus:border-[var(--htc-primary)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending || Boolean(state?.ok)}
        className="ws-btn-primary w-full disabled:opacity-60"
      >
        {pending ? "Sending…" : state?.ok ? "Email requested" : "Send reset link"}
      </button>
      <p className="text-center text-sm ws-muted">
        <Link
          href="/login"
          className="text-[var(--htc-primary)] underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

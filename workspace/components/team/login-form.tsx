"use client";

import { useActionState } from "react";

import { loginAction } from "@/app/(app)/team/auth-actions";
import { DEMO_LOGIN } from "@/lib/program4/demo-login";

export function LoginForm({ next, accepted }: { next: string; accepted?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      {accepted ? (
        <p className="rounded-sm border border-[color-mix(in_srgb,var(--soft-sage)_70%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_25%,transparent)] px-3 py-2 text-sm text-[var(--forest-sage)]">
          Invite accepted. Sign in with your new password.
        </p>
      ) : null}
      {state?.error ? (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <label className="block">
        <span className="ws-eyebrow">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={DEMO_LOGIN.email}
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
      </label>
      <label className="block">
        <span className="ws-eyebrow">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-[var(--forest-sage)] px-4 py-3 text-sm font-medium text-[var(--true-white)] hover:bg-[var(--heritage-sage)] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

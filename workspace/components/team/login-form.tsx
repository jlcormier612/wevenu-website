"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { loginAction } from "@/app/(app)/team/auth-actions";
import {
  activatePasswordInputType,
  activatePasswordToggleLabel,
} from "@/lib/program4/activate-account-form";

export function LoginForm({ next, accepted }: { next: string; accepted?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      {accepted ? (
        <p className="rounded-sm border border-[color-mix(in_srgb,var(--soft-sage)_70%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_25%,transparent)] px-3 py-2 text-sm text-foreground">
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
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)] text-foreground"
        />
      </label>
      <div>
        <label htmlFor="workspace-login-password" className="block">
          <span className="ws-eyebrow">Password</span>
        </label>
        <div className="relative mt-2">
          <input
            id="workspace-login-password"
            name="password"
            type={activatePasswordInputType(showPassword)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 pr-10 text-sm outline-none focus:border-[var(--heritage-sage)] text-foreground"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={activatePasswordToggleLabel(showPassword, "password")}
            aria-controls="workspace-login-password"
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
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

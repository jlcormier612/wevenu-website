"use client";

import { useActionState } from "react";

import { activateAccountAction } from "@/app/activate/actions";

export function ActivateAccountForm({
  token,
  email,
  venueName,
}: {
  token: string;
  email: string;
  venueName: string;
}) {
  const [state, action, pending] = useActionState(activateAccountAction, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-light)_80%,transparent)] bg-[var(--warm-gray)]/40 px-4 py-3 text-sm">
        <p className="font-medium text-[var(--forest-sage)]">{venueName}</p>
      </div>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}
      <label className="block">
        <span className="ws-eyebrow">Email</span>
        <input
          type="email"
          value={email}
          readOnly
          autoComplete="username"
          aria-readonly="true"
          className="mt-2 w-full cursor-default rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[var(--warm-gray)]/50 px-3 py-2.5 text-sm text-[var(--forest-sage)] outline-none"
        />
      </label>
      <label className="block">
        <span className="ws-eyebrow">Create password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby="activate-password-hint"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
        <span id="activate-password-hint" className="mt-1.5 block text-xs ws-muted">
          At least 8 characters.
        </span>
      </label>
      <label className="block">
        <span className="ws-eyebrow">Confirm password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-[var(--forest-sage)] px-4 py-3 text-sm font-medium text-[var(--true-white)] transition-colors duration-200 hover:bg-[var(--heritage-sage)] disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? "Activating…" : "Activate account"}
      </button>
    </form>
  );
}

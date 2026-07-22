"use client";

import { useActionState } from "react";

import { acceptInviteAction } from "@/app/(app)/team/auth-actions";
import { ROLE_LABELS } from "@/lib/program4/labels";
import type { TeamRole } from "@/lib/program4/types";

export function AcceptInviteForm({
  token,
  name,
  email,
  role,
}: {
  token: string;
  name: string;
  email: string;
  role: TeamRole;
}) {
  const [state, action, pending] = useActionState(acceptInviteAction, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-light)_80%,transparent)] bg-[var(--warm-gray)]/40 px-4 py-3 text-sm">
        <p className="font-medium text-[var(--forest-sage)]">{name}</p>
        <p className="ws-muted">{email}</p>
        <p className="mt-1 text-xs ws-muted">Role: {ROLE_LABELS[role]}</p>
      </div>
      {state?.error ? (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <label className="block">
        <span className="ws-eyebrow">Create password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
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
        className="w-full rounded-sm bg-[var(--forest-sage)] px-4 py-3 text-sm font-medium text-[var(--true-white)] hover:bg-[var(--heritage-sage)] disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create password & continue"}
      </button>
    </form>
  );
}

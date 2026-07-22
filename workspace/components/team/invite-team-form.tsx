"use client";

import { useActionState } from "react";

import { inviteTeamMemberAction } from "@/app/(app)/team/auth-actions";
import { ROLE_LABELS, TEAM_ROLES } from "@/lib/program4/labels";

export function InviteTeamForm() {
  const [state, action, pending] = useActionState(inviteTeamMemberAction, null);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state?.error ? (
        <p className="sm:col-span-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="sm:col-span-2 rounded-sm border border-[color-mix(in_srgb,var(--soft-sage)_70%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_25%,transparent)] px-3 py-2 text-sm text-[var(--forest-sage)]">
          Invite sent{state.inviteUrl ? " (dry-run logs the link if Resend is unset)" : ""}.
          {state.inviteUrl ? (
            <>
              {" "}
              <a
                href={state.inviteUrl}
                className="underline underline-offset-4"
              >
                Open invite link
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="ws-eyebrow">Name</span>
        <input
          name="name"
          required
          placeholder="Alex Morgan"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
      </label>
      <label className="block text-sm">
        <span className="ws-eyebrow">Email</span>
        <input
          name="email"
          type="email"
          required
          placeholder="alex@hellotocheers.com"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="ws-eyebrow">Role</span>
        <select
          name="role"
          defaultValue="viewer"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        >
          {TEAM_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-[var(--forest-sage)] px-4 py-2.5 text-sm font-medium text-[var(--true-white)] hover:bg-[var(--heritage-sage)] disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </form>
  );
}

import {
  endImpersonateAction,
  startImpersonateAction,
} from "@/app/(app)/team/auth-actions";
import type { TeamMemberProfile } from "@/lib/program4/types";

export function ImpersonateBanner({
  realUser,
  actingAs,
}: {
  realUser: TeamMemberProfile;
  actingAs: TeamMemberProfile;
}) {
  return (
    <div className="border-b border-[color-mix(in_srgb,var(--heritage-sage)_35%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_40%,transparent)] px-8 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-[var(--forest-sage)]">
          Impersonating <span className="font-medium">{actingAs.name}</span>
          <span className="ws-muted">
            {" "}
            · signed in as {realUser.name}
          </span>
        </p>
        <form action={endImpersonateAction}>
          <button
            type="submit"
            className="rounded-sm border border-[color-mix(in_srgb,var(--forest-sage)_40%,transparent)] bg-[var(--true-white)] px-3 py-1.5 text-xs font-medium text-[var(--forest-sage)] hover:border-[var(--heritage-sage)]"
          >
            End impersonation
          </button>
        </form>
      </div>
    </div>
  );
}

export function ImpersonateButton({
  member,
  disabled,
}: {
  member: TeamMemberProfile;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <form action={startImpersonateAction}>
      <input type="hidden" name="memberId" value={member.id} />
      <button
        type="submit"
        className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm font-medium text-[var(--forest-sage)] hover:border-[var(--heritage-sage)]"
      >
        Impersonate
      </button>
    </form>
  );
}

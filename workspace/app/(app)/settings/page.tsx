import Link from "next/link";

import { logoutAction } from "@/app/(app)/team/auth-actions";
import {
  DataTable,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/shared/ui";
import { DEMO_LOGIN } from "@/lib/program4/demo-login";
import { AVAILABILITY_LABELS, DEPARTMENT_LABELS, ROLE_LABELS } from "@/lib/program4/labels";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/program4/permissions";
import {
  actorCan,
  getActingMember,
  getSessionMember,
  isImpersonating,
} from "@/lib/program4/session";
import {
  ensureProgram4Data,
  getTeamProfilesSync,
} from "@/lib/program4/store";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await ensureProgram4Data();
  const actor = await getActingMember();
  const sessionUser = await getSessionMember();
  const impersonating = await isImpersonating();
  const team = getTeamProfilesSync().filter((m) => m.active);
  const canManageTeam = await actorCan("manage_team");
  const permissions = ROLE_PERMISSIONS[actor.role];

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Team roster, role permissions, and session auth (Project 8)."
      />

      <Panel title="Signed in">
        <p className="mb-4 text-sm leading-relaxed ws-muted">
          You are signed in as{" "}
          <span className="font-medium text-[var(--forest-sage)]">
            {sessionUser?.name ?? "—"}
          </span>
          {sessionUser ? ` (${ROLE_LABELS[sessionUser.role]})` : null}.
          {impersonating ? (
            <>
              {" "}
              Currently impersonating{" "}
              <span className="font-medium text-[var(--forest-sage)]">{actor.name}</span> —
              nav and permissions follow their role.
            </>
          ) : (
            <> Permissions follow your role matrix.</>
          )}
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-4 py-2.5 text-sm font-medium text-[var(--forest-sage)] hover:border-[var(--heritage-sage)]"
          >
            Sign out
          </button>
        </form>
      </Panel>

      <Panel title="Your permissions" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {ALL_PERMISSIONS.map((p) => (
            <li key={p}>
              <StatusPill tone={permissions.includes(p) ? "good" : "muted"}>
                {p}
              </StatusPill>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Team members"
        className="mt-6"
        action={
          <Link
            href="/team"
            className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Open Team →
          </Link>
        }
      >
        <DataTable
          headers={["Name", "Role", "Department", "Availability", ""]}
          rows={team.map((m) => [
            <div key={m.id} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--soft-sage)]/45 text-xs font-medium">
                {m.initials}
              </span>
              <div>
                <span className="font-medium">{m.name}</span>
                <p className="text-xs ws-muted">{m.title}</p>
              </div>
            </div>,
            ROLE_LABELS[m.role],
            DEPARTMENT_LABELS[m.department],
            <StatusPill
              key={`${m.id}-av`}
              tone={m.availability === "available" ? "good" : "muted"}
            >
              {AVAILABILITY_LABELS[m.availability]}
            </StatusPill>,
            <Link
              key={`${m.id}-open`}
              href={`/team/${m.id}`}
              className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
            >
              {canManageTeam ? "Edit" : "View"}
            </Link>,
          ])}
        />
      </Panel>

      <Panel title="Notification preferences" className="mt-6">
        <ul className="space-y-4">
          {[
            "New Inquiry",
            "Walkthrough Scheduled",
            "Subscription Purchased",
            "White Glove Purchased",
            "Welcome Back Requested",
            "Founder Spot Filled",
            "Support Request Submitted",
          ].map((label) => (
            <li
              key={label}
              className="flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--taupe-light)_70%,transparent)] pb-3 last:border-0"
            >
              <span className="text-sm">{label}</span>
              <StatusPill tone="muted">Email + in-app (stub)</StatusPill>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Auth (Project 8)" className="mt-6">
        <p className="text-sm leading-relaxed ws-muted">
          File-based sessions under{" "}
          <code className="rounded-sm bg-[var(--warm-gray)] px-1.5 py-0.5">workspace/.data/</code>
          . Passwords are scrypt-hashed — not production SSO. Demo login:{" "}
          <code className="rounded-sm bg-[var(--warm-gray)] px-1.5 py-0.5 text-[var(--forest-sage)]">
            {DEMO_LOGIN.email}
          </code>{" "}
          /{" "}
          <code className="rounded-sm bg-[var(--warm-gray)] px-1.5 py-0.5 text-[var(--forest-sage)]">
            {DEMO_LOGIN.password}
          </code>
          . Owner/Admin impersonate from a teammate&apos;s profile — there is no global View
          as.
        </p>
      </Panel>
    </div>
  );
}

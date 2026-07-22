import Link from "next/link";

import { InviteTeamForm } from "@/components/team/invite-team-form";
import {
  DataTable,
  PageHeader,
  Panel,
  StatTile,
  StatusPill,
} from "@/components/shared/ui";
import { getData } from "@/lib/data/store";
import { getPendingInvitesSync, inviteAcceptUrl } from "@/lib/program4/auth-store";
import { AVAILABILITY_LABELS, DEPARTMENT_LABELS, ROLE_LABELS } from "@/lib/program4/labels";
import { actorCan } from "@/lib/program4/session";
import {
  ensureProgram4Data,
  getCommissionPlanSync,
  getTeamProfilesSync,
} from "@/lib/program4/store";
import { redirect } from "next/navigation";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  await ensureProgram4Data();
  if (!(await actorCan("view_team"))) {
    redirect("/today");
  }

  const canManage = await actorCan("manage_team");
  const members = getTeamProfilesSync().filter((m) => m.active);
  const pendingInvites = getPendingInvitesSync();
  const data = getData();

  return (
    <div>
      <PageHeader
        eyebrow="Team Operations"
        title="Team"
        description="Invite teammates, assign roles, and manage commissions. Sign-in is real — Owner/Admin can impersonate for support."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Active members" value={members.length} />
        <StatTile
          label="Departments"
          value={new Set(members.map((m) => m.department)).size}
        />
        <StatTile label="Pending invites" value={pendingInvites.length} />
      </div>

      {canManage ? (
        <Panel title="Invite teammate" className="mb-6">
          <p className="mb-4 text-sm leading-relaxed ws-muted">
            Flow: Invite → Accept → Create password → Done. Email uses{" "}
            <code className="rounded-sm bg-[var(--warm-gray)] px-1 py-0.5 text-xs">
              @shared/email
            </code>{" "}
            (dry-run without Resend).
          </p>
          <InviteTeamForm />
        </Panel>
      ) : null}

      {canManage && pendingInvites.length > 0 ? (
        <Panel title="Pending invites" className="mb-6">
          <DataTable
            headers={["Name", "Email", "Role", "Sent", "Link"]}
            rows={pendingInvites.map((inv) => [
              inv.name,
              inv.email,
              ROLE_LABELS[inv.role],
              new Date(inv.createdAt).toLocaleDateString(),
              <a
                key={inv.id}
                href={inviteAcceptUrl(inv.token)}
                className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
              >
                /invite/…
              </a>,
            ])}
          />
        </Panel>
      ) : null}

      <Panel title="Members">
        <DataTable
          headers={["Name", "Role", "Department", "Plan", "Availability", ""]}
          rows={members.map((m) => {
            const plan = m.commissionPlanId
              ? getCommissionPlanSync(m.commissionPlanId)
              : null;
            const assigned = data.relationships.filter(
              (r) => r.assignedTeamMemberId === m.id,
            ).length;
            return [
              <div key={m.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--soft-sage)]/45 text-xs font-medium">
                  {m.initials}
                </span>
                <div>
                  <Link
                    href={`/team/${m.id}`}
                    className="font-medium hover:text-[var(--heritage-sage)]"
                  >
                    {m.name}
                  </Link>
                  <p className="text-xs ws-muted">
                    {m.title}
                    {assigned ? ` · ${assigned} venues` : null}
                  </p>
                </div>
              </div>,
              ROLE_LABELS[m.role],
              DEPARTMENT_LABELS[m.department],
              plan?.name ?? "—",
              <StatusPill
                key={`${m.id}-av`}
                tone={m.availability === "available" ? "good" : "muted"}
              >
                {AVAILABILITY_LABELS[m.availability]}
              </StatusPill>,
              <Link
                key={`${m.id}-link`}
                href={`/team/${m.id}`}
                className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
              >
                Open
              </Link>,
            ];
          })}
        />
      </Panel>
    </div>
  );
}

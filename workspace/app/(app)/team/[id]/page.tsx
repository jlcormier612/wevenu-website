import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ImpersonateButton } from "@/components/team/impersonate-controls";
import { PageHeader, Panel, StatusPill } from "@/components/shared/ui";
import { getData, getRelationships } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";
import {
  AVAILABILITY_LABELS,
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  TEAM_ROLES,
} from "@/lib/program4/labels";
import {
  actorCan,
  getSessionMember,
  roleCanImpersonate,
} from "@/lib/program4/session";
import {
  ensureProgram4Data,
  getCommissionLedgerSync,
  getCommissionPlansSync,
  getTeamProfileSync,
} from "@/lib/program4/store";
import { COMMISSION_EVENT_LABELS } from "@/lib/program4/seed";
import { updateTeamMemberAction } from "../actions";

export const metadata = { title: "Team member" };

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureProgram4Data();
  if (!(await actorCan("view_team"))) {
    redirect("/today");
  }

  const { id } = await params;
  const member = getTeamProfileSync(id);
  if (!member) notFound();

  const canManage = await actorCan("manage_team");
  const sessionUser = await getSessionMember();
  const canImpersonate = Boolean(
    sessionUser &&
      roleCanImpersonate(sessionUser.role) &&
      sessionUser.id !== member.id &&
      member.active,
  );
  const plans = getCommissionPlansSync();
  const ledger = getCommissionLedgerSync({ teamMemberId: member.id }).slice(0, 8);
  const venues = getRelationships().filter((r) => r.assignedTeamMemberId === member.id);
  const periodTotal = getCommissionLedgerSync({
    teamMemberId: member.id,
    periodKey: "2026-07",
  })
    .filter((e) => e.status !== "void")
    .reduce((s, e) => s + e.commissionCents, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title={member.name}
        description={`${member.title} · ${DEPARTMENT_LABELS[member.department]}`}
        action={
          <Link
            href="/team"
            className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            ← All team
          </Link>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--soft-sage)]/50 font-heading text-xl">
          {member.initials}
        </span>
        <div>
          <p className="font-medium">{ROLE_LABELS[member.role]}</p>
          <p className="text-sm ws-muted">{member.email}</p>
        </div>
        <StatusPill tone={member.availability === "available" ? "good" : "muted"}>
          {AVAILABILITY_LABELS[member.availability]}
        </StatusPill>
        {member.territory ? (
          <StatusPill tone="neutral">Territory: {member.territory}</StatusPill>
        ) : (
          <StatusPill tone="muted">Territory: stub</StatusPill>
        )}
        {!member.active ? <StatusPill tone="muted">Inactive (pending invite)</StatusPill> : null}
      </div>

      {canImpersonate ? (
        <Panel title="Support impersonation" className="mb-6">
          <p className="mb-3 text-sm leading-relaxed ws-muted">
            View the workspace with this member&apos;s permissions (HubSpot-style). A banner
            lets you end impersonation anytime. Owner and Administrator only — not global View
            as.
          </p>
          <ImpersonateButton member={member} />
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Goals">
          {member.goals.length === 0 ? (
            <p className="text-sm ws-muted">No goals set.</p>
          ) : (
            <ul className="space-y-5">
              {member.goals.map((g) => {
                const pct = Math.min(100, Math.round((g.current / Math.max(g.target, 1)) * 100));
                const currentLabel =
                  g.unit === "currency_cents"
                    ? formatCurrency(g.current)
                    : g.unit === "percent"
                      ? `${g.current}%`
                      : String(g.current);
                const targetLabel =
                  g.unit === "currency_cents"
                    ? formatCurrency(g.target)
                    : g.unit === "percent"
                      ? `${g.target}%`
                      : String(g.target);
                return (
                  <li key={g.id}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span>{g.label}</span>
                      <span className="ws-muted">
                        {currentLabel} / {targetLabel}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-sm bg-[var(--taupe-light)]/50">
                      <div
                        className="h-full rounded-sm bg-[var(--heritage-sage)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs ws-muted capitalize">{g.period}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="July commissions">
          <p className="font-heading text-3xl">{formatCurrency(periodTotal)}</p>
          <p className="mt-1 text-sm ws-muted">This period · pending + approved + paid</p>
          <ul className="mt-5 space-y-3">
            {ledger.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 text-sm">
                <span>
                  {COMMISSION_EVENT_LABELS[e.eventType]}
                  <span className="mt-0.5 block text-xs ws-muted">
                    {getData().relationships.find((r) => r.id === e.relationshipId)?.venue.name ??
                      e.relationshipId}
                  </span>
                </span>
                <span className="font-medium">{formatCurrency(e.commissionCents)}</span>
              </li>
            ))}
            {ledger.length === 0 ? (
              <li className="text-sm ws-muted">No ledger entries yet.</li>
            ) : null}
          </ul>
          <Link
            href="/commissions"
            className="mt-4 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Full ledger →
          </Link>
        </Panel>
      </div>

      <Panel title="Assigned venues" className="mt-6">
        {venues.length === 0 ? (
          <p className="text-sm ws-muted">No venues assigned.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {venues.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/relationships/${r.id}`}
                  className="text-sm font-medium hover:text-[var(--heritage-sage)]"
                >
                  {r.venue.name}
                </Link>
                <span className="ml-2 text-xs ws-muted">{r.currentStageLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {canManage ? (
        <Panel title="Edit member" className="mt-6">
          <form action={updateTeamMemberAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={member.id} />
            <label className="block text-sm">
              <span className="ws-eyebrow">Title</span>
              <input
                name="title"
                defaultValue={member.title}
                className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
              />
            </label>
            <label className="block text-sm">
              <span className="ws-eyebrow">Role</span>
              <select
                name="role"
                defaultValue={member.role}
                className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
              >
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="ws-eyebrow">Availability</span>
              <select
                name="availability"
                defaultValue={member.availability}
                className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
              >
                {Object.entries(AVAILABILITY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="ws-eyebrow">Commission plan</span>
              <select
                name="commissionPlanId"
                defaultValue={member.commissionPlanId ?? ""}
                className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
              >
                <option value="">None</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="ws-eyebrow">Territory (stub)</span>
              <input
                name="territory"
                defaultValue={member.territory ?? ""}
                placeholder="e.g. Southeast"
                className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-sm bg-[var(--forest-sage)] px-4 py-2.5 text-sm font-medium text-[var(--true-white)] hover:bg-[var(--heritage-sage)]"
              >
                Save changes
              </button>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

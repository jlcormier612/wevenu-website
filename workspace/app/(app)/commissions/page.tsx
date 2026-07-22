import Link from "next/link";
import { redirect } from "next/navigation";

import {
  DataTable,
  PageHeader,
  Panel,
  StatTile,
  StatusPill,
} from "@/components/shared/ui";
import { getData, getRelationship } from "@/lib/data/store";
import {
  summarizeCommissionsByRep,
  syncCommissionsFromTimeline,
} from "@/lib/program4/commissions";
import { COMMISSION_EVENT_LABELS } from "@/lib/program4/seed";
import { actorCan } from "@/lib/program4/session";
import {
  ensureProgram4Data,
  getCommissionLedgerSync,
  getCommissionPlansSync,
  getTeamProfileSync,
  periodKeyFromIso,
} from "@/lib/program4/store";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Commissions" };

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; rep?: string }>;
}) {
  await ensureProgram4Data();
  if (!(await actorCan("view_commissions"))) {
    redirect("/today");
  }

  const params = await searchParams;
  const data = getData();

  // Best-effort: fill ledger from timeline when viewing
  await syncCommissionsFromTimeline({
    relationships: data.relationships,
    timelineEvents: data.timelineEvents,
    subscriptions: data.subscriptions,
  });

  const period = params.period || periodKeyFromIso("2026-07-21T12:00:00.000Z");
  const repFilter = params.rep || "";

  let entries = getCommissionLedgerSync({ periodKey: period });
  if (repFilter) {
    entries = entries.filter((e) => e.teamMemberId === repFilter);
  }

  const byRep = summarizeCommissionsByRep(getCommissionLedgerSync({ periodKey: period }));
  const periodTotal = entries
    .filter((e) => e.status !== "void")
    .reduce((s, e) => s + e.commissionCents, 0);
  const plans = getCommissionPlansSync().filter((p) => p.active);

  const periods = [
    ...new Set(getCommissionLedgerSync().map((e) => e.periodKey)),
  ].sort()
    .reverse();

  return (
    <div>
      <PageHeader
        eyebrow="Business"
        title="Commissions"
        description="Ledger by period and rep — calculated from commission plans when walkthroughs, subscriptions, White Glove, renewals, referrals, and expansions land."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Period total" value={formatCurrency(periodTotal)} hint={period} />
        <StatTile label="Entries" value={entries.filter((e) => e.status !== "void").length} />
        <StatTile label="Active plans" value={plans.length} />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {periods.map((p) => (
          <Link
            key={p}
            href={`/commissions?period=${p}${repFilter ? `&rep=${repFilter}` : ""}`}
            className={`rounded-sm px-3 py-1.5 text-sm ${
              p === period
                ? "bg-[var(--forest-sage)] text-[var(--true-white)]"
                : "bg-[var(--warm-gray)] hover:bg-[var(--soft-sage)]/40"
            }`}
          >
            {p}
          </Link>
        ))}
        {repFilter ? (
          <Link
            href={`/commissions?period=${period}`}
            className="rounded-sm px-3 py-1.5 text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Clear rep filter
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="By rep" className="lg:col-span-2">
          <ul className="space-y-3">
            {byRep.map((row) => {
              const tm = getTeamProfileSync(row.teamMemberId);
              return (
                <li key={row.teamMemberId}>
                  <Link
                    href={`/commissions?period=${period}&rep=${row.teamMemberId}`}
                    className="flex items-center justify-between gap-3 text-sm hover:text-[var(--heritage-sage)]"
                  >
                    <span className="font-medium">{tm?.name ?? row.teamMemberId}</span>
                    <span>
                      {formatCurrency(row.totalCents)}
                      <span className="ml-2 text-xs ws-muted">{row.count}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {byRep.length === 0 ? (
              <li className="text-sm ws-muted">No commissions in this period.</li>
            ) : null}
          </ul>
        </Panel>

        <Panel title="Plans" className="lg:col-span-3">
          <ul className="space-y-4">
            {plans.map((plan) => (
              <li key={plan.id} className="border-b border-[color-mix(in_srgb,var(--taupe-light)_70%,transparent)] pb-3 last:border-0">
                <p className="font-medium">{plan.name}</p>
                <p className="mt-1 text-sm ws-muted">{plan.description}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(plan.rates).map(([event, rate]) => {
                    if (!rate) return null;
                    const label =
                      rate.mode === "flat"
                        ? formatCurrency(rate.cents)
                        : `${rate.bps / 100}%`;
                    return (
                      <li key={event}>
                        <StatusPill tone="muted">
                          {COMMISSION_EVENT_LABELS[event as keyof typeof COMMISSION_EVENT_LABELS] ??
                            event}
                          : {label}
                        </StatusPill>
                      </li>
                    );
                  })}
                  {Object.keys(plan.rates).length === 0 ? (
                    <li>
                      <StatusPill tone="muted">No rates</StatusPill>
                    </li>
                  ) : null}
                </ul>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Ledger" className="mt-6">
        <DataTable
          headers={["Date", "Rep", "Venue", "Event", "Basis", "Commission", "Status"]}
          rows={entries.map((e) => {
            const tm = getTeamProfileSync(e.teamMemberId);
            const rel = getRelationship(e.relationshipId);
            return [
              formatDate(e.occurredAt),
              tm ? (
                <Link
                  key={`${e.id}-tm`}
                  href={`/team/${tm.id}`}
                  className="hover:text-[var(--heritage-sage)]"
                >
                  {tm.name}
                </Link>
              ) : (
                e.teamMemberId
              ),
              rel ? (
                <Link
                  key={`${e.id}-rel`}
                  href={`/relationships/${rel.id}`}
                  className="hover:text-[var(--heritage-sage)]"
                >
                  {rel.venue.name}
                </Link>
              ) : (
                e.relationshipId
              ),
              COMMISSION_EVENT_LABELS[e.eventType],
              e.basisCents > 0 ? formatCurrency(e.basisCents) : "—",
              formatCurrency(e.commissionCents),
              <StatusPill
                key={`${e.id}-st`}
                tone={
                  e.status === "paid"
                    ? "good"
                    : e.status === "void"
                      ? "muted"
                      : e.status === "approved"
                        ? "neutral"
                        : "warn"
                }
              >
                {e.status}
              </StatusPill>,
            ];
          })}
        />
      </Panel>
    </div>
  );
}

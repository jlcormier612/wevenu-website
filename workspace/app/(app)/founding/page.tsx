import Link from "next/link";
import { redirect } from "next/navigation";

import {
  DataTable,
  PageHeader,
  Panel,
  RelationshipLink,
  StatTile,
  StatusPill,
} from "@/components/shared/ui";
import {
  getData,
  getTeamMember,
} from "@/lib/data/store";
import { computeFounderDashboardMetrics } from "@/lib/program4/founder-metrics";
import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import {
  formatCurrency,
  formatDate,
  formatRelativeDay,
  WELCOME_BACK_LABELS,
} from "@/lib/utils";

export const metadata = { title: "Founder Dashboard" };

function wbTone(
  status: "none" | "pending" | "verified" | "rejected" | "expired",
): "neutral" | "good" | "warn" | "muted" {
  if (status === "verified") return "good";
  if (status === "pending") return "warn";
  if (status === "rejected") return "muted";
  return "neutral";
}

export default async function FounderDashboardPage() {
  await ensureProgram4Data();
  if (!(await actorCan("view_founding"))) {
    redirect("/today");
  }

  const metrics = computeFounderDashboardMetrics(getData());
  const fillPercent =
    metrics.capacity > 0
      ? Math.min(100, Math.round((metrics.foundingCount / metrics.capacity) * 100))
      : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Founding Program"
        title="Founder Dashboard"
        description="Owner view of founder seats, projected revenue, and Welcome Back verification — one relationship record throughout."
      />

      <section className="ws-panel mb-8 overflow-hidden p-0">
        <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_22%,var(--warm-gray))] px-6 py-6 md:px-8 md:py-8">
          <p className="ws-eyebrow">Founder members</p>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="font-heading text-5xl tracking-tight md:text-6xl">
              {metrics.foundingCount}
              <span className="text-3xl text-[color-mix(in_srgb,var(--forest-sage)_45%,transparent)] md:text-4xl">
                {" "}
                / {metrics.capacity}
              </span>
            </p>
            <p className="pb-1 text-lg ws-muted">
              {metrics.remaining} remaining
              {metrics.newThisWeek > 0
                ? ` · ${metrics.newThisWeek} new this week`
                : null}
            </p>
          </div>
          <div className="mt-5 h-2 max-w-xl overflow-hidden rounded-sm bg-[var(--taupe-light)]/55">
            <div
              className="h-full rounded-sm bg-[var(--heritage-sage)] transition-[width]"
              style={{ width: `${fillPercent}%` }}
              role="progressbar"
              aria-valuenow={metrics.foundingCount}
              aria-valuemin={0}
              aria-valuemax={metrics.capacity}
              aria-label="Founder program fill"
            />
          </div>
        </div>

        <div className="grid gap-0 sm:grid-cols-3">
          <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] p-6 sm:border-b-0 sm:border-r">
            <p className="ws-eyebrow">Estimated close date</p>
            <p className="mt-3 font-heading text-3xl tracking-tight">
              {metrics.estimatedCloseDate
                ? formatDate(metrics.estimatedCloseDate)
                : "—"}
            </p>
            <p className="mt-2 text-sm ws-muted">{metrics.estimatedCloseNote}</p>
          </div>
          <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] p-6 sm:border-b-0 sm:border-r">
            <p className="ws-eyebrow">Projected MRR</p>
            <p className="mt-3 font-heading text-3xl tracking-tight">
              {formatCurrency(metrics.projectedMrrCents)}
            </p>
            <p className="mt-2 text-sm ws-muted">
              Monthly founder MRR from plans &amp; subscriptions
            </p>
          </div>
          <div className="p-6">
            <p className="ws-eyebrow">Founder revenue</p>
            <p className="mt-3 font-heading text-3xl tracking-tight">
              {formatCurrency(metrics.founderRevenueCents)}
            </p>
            <p className="mt-2 text-sm ws-muted">{metrics.founderRevenueNote}</p>
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Welcome Back · approved"
          value={metrics.welcomeBackApproved}
          hint="Verified · Founding pricing eligibility"
          href="/sales?view=list&wb=verified"
        />
        <StatTile
          label="Welcome Back · pending"
          value={metrics.welcomeBackPending}
          hint="Open the Relationship to Approve / Reject / Follow up"
          href="/sales?view=list&wb=pending"
        />
        <StatTile
          label="Welcome Back · rejected"
          value={metrics.welcomeBackRejected}
          hint={
            metrics.welcomeBackExpired > 0
              ? `${metrics.welcomeBackExpired} expired · verify on the Relationship`
              : "Updated when Reject is chosen on the Relationship"
          }
          href="/sales?view=list&wb=rejected"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          title="Founding venues"
          className="lg:col-span-3"
          action={
            <Link
              href="/sales?view=list"
              className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
            >
              All relationships →
            </Link>
          }
        >
          {metrics.founders.length === 0 ? (
            <p className="text-sm ws-muted">No founding members yet.</p>
          ) : (
            <DataTable
              headers={["Venue", "Plan", "Welcome Back", "Owner", "Joined"]}
              rows={metrics.founders.map((r) => {
                const tm = getTeamMember(r.assignedTeamMemberId);
                return [
                  <RelationshipLink key={r.id} id={r.id} name={r.venue.name} />,
                  r.planName,
                  r.welcomeBackRequested ? (
                    <StatusPill key={`${r.id}-wb`} tone={wbTone(r.welcomeBackVerified)}>
                      {WELCOME_BACK_LABELS[r.welcomeBackVerified]}
                    </StatusPill>
                  ) : (
                    "—"
                  ),
                  tm?.name ?? "—",
                  formatRelativeDay(r.createdAt),
                ];
              })}
            />
          )}
        </Panel>

        <Panel title="Recent founder activity" className="lg:col-span-2">
          {metrics.recentActivity.length === 0 ? (
            <p className="text-sm ws-muted">No founder timeline events yet.</p>
          ) : (
            <ul className="space-y-5">
              {metrics.recentActivity.map((e) => (
                <li key={e.id} className="text-sm">
                  <Link
                    href={`/relationships/${e.relationshipId}`}
                    className="font-medium text-[var(--forest-sage)] hover:underline"
                  >
                    {e.venueName}
                  </Link>
                  <p className="mt-0.5 text-[var(--forest-sage)]">{e.title}</p>
                  <p className="ws-muted">{formatRelativeDay(e.occurredAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { LuvBriefingCard } from "@/components/luv/luv-briefing";
import { LuvMark } from "@/components/luv/luv-mark";
import { PageHeader, Panel } from "@/components/shared/ui";
import { getData } from "@/lib/data/store";
import { loadLuvBriefing } from "@/lib/luv/load";
import { actorCan, getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import {
  computeBusinessDashboardMetrics,
  type MetricConfidence,
} from "@/lib/program9/business-metrics";
import { cn, formatCurrency } from "@/lib/utils";

export const metadata = { title: "Business" };

function confidenceLabel(c: MetricConfidence): string | null {
  if (c === "actual") return "Actual";
  if (c === "estimate") return "Estimate";
  return null;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value}%`;
}

function MetricTag({ confidence }: { confidence: MetricConfidence }) {
  const label = confidenceLabel(confidence);
  if (!label) return null;
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center rounded-sm px-1.5 py-0.5 text-[0.65rem] tracking-wide uppercase",
        confidence === "actual"
          ? "bg-[var(--htc-soft-sage)] text-[var(--htc-forest)]"
          : "bg-[var(--htc-linen)] text-[var(--htc-text)]",
      )}
    >
      {label}
    </span>
  );
}

function MetricTile({
  label,
  value,
  hint,
  href,
  confidence,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  confidence?: MetricConfidence;
}) {
  const inner = (
    <>
      <p className="ws-eyebrow">
        {label}
        {confidence ? <MetricTag confidence={confidence} /> : null}
      </p>
      <p className="mt-3 font-heading text-[2rem] tracking-tight text-[var(--htc-forest)] md:text-[2rem]">
        {value}
      </p>
      {hint ? <p className="mt-2 text-sm ws-muted">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="ws-panel block p-5 hover:border-[var(--htc-primary)]/50"
      >
        {inner}
      </Link>
    );
  }

  return <div className="ws-panel p-5">{inner}</div>;
}

export default async function BusinessPage() {
  await ensureProgram4Data();
  if (!(await actorCan("view_business_dashboard"))) {
    redirect("/today");
  }

  const actor = await getActingMember();
  if (!actor) {
    redirect("/login?reason=no_access");
  }
  const metrics = computeBusinessDashboardMetrics(getData());
  const { briefing, drafts } = loadLuvBriefing(actor);
  const maxNewSubs = Math.max(...metrics.subscriptionGrowth.map((m) => m.newSubs), 1);
  const hasGrowth = metrics.subscriptionGrowth.some((row) => row.newSubs > 0);

  return (
    <div>
      <PageHeader
        eyebrow="Business"
        title="Company pulse"
        description="Revenue, relationships, conversions, and customer health at a glance."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs tracking-wide text-[var(--htc-dusty)]">
              <LuvMark size={11} />
              Luv is watching the board
            </span>
            <Link href="/today" className="ws-btn-secondary">
              Open Today
            </Link>
          </div>
        }
      />

      <div className="mb-8">
        <LuvBriefingCard briefing={briefing} drafts={drafts} />
      </div>

      {/* Primary KPIs — approved revised layout */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="MRR"
          value={formatCurrency(metrics.mrrCents)}
          hint={`${metrics.activeCustomers} subscribed customer${metrics.activeCustomers === 1 ? "" : "s"}`}
          confidence={metrics.mrrConfidence}
        />
        <MetricTile
          label="Paying customers"
          value={metrics.activeCustomers}
          hint={
            metrics.activeCustomers === 0
              ? "No live customers"
              : `${metrics.activeCustomers} subscribed+`
          }
          confidence={metrics.activeCustomers === 0 ? "empty" : "actual"}
          href="/customer-success"
        />
        <MetricTile
          label="Open pipeline"
          value={metrics.pipelineCount}
          hint={formatCurrency(metrics.pipelineValueCents)}
          confidence={metrics.pipelineCount === 0 ? "empty" : "actual"}
          href="/sales"
        />
        <MetricTile
          label="Conversion rate"
          value={formatPercent(metrics.inquiryConversionPercent)}
          hint={metrics.inquiryConversionNote}
        />
      </div>

      {/* Founding / Welcome Back / White Glove */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Founding Memberships"
          value={`${metrics.founderCount}/${metrics.founderCapacity}`}
          hint={`${metrics.founderRemaining} of ${metrics.founderCapacity} remaining`}
          href="/founding"
        />
        <MetricTile
          label="Welcome Back"
          value={`${metrics.welcomeBackRequested}/${metrics.welcomeBackApproved}`}
          hint={`${metrics.welcomeBackRequested} requested · ${metrics.welcomeBackApproved} approved${
            metrics.welcomeBackPending > 0
              ? ` · ${metrics.welcomeBackPending} pending`
              : ""
          }`}
          href="/founding"
        />
        <MetricTile
          label="White Glove customers"
          value={metrics.whiteGloveCustomerCount}
          hint="Onboarding type = White Glove"
          href="/onboarding"
        />
        <MetricTile
          label="White Glove revenue"
          value={
            metrics.whiteGloveRevenueConfidence === "empty" &&
            metrics.whiteGloveRevenueCents === 0
              ? "—"
              : formatCurrency(metrics.whiteGloveRevenueCents)
          }
          hint={metrics.whiteGloveRevenueNote}
          confidence={
            metrics.whiteGloveRevenueCents > 0
              ? metrics.whiteGloveRevenueConfidence
              : "empty"
          }
          href="/onboarding"
        />
      </div>

      {/* Customer health & renewals (existing metric definitions) */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Churn"
          value={`${metrics.churnPercent}%`}
          hint={metrics.churnNote}
        />
        <MetricTile
          label="Trials"
          value={metrics.trialCount === 0 ? "—" : metrics.trialCount}
          hint={metrics.trialNote}
          confidence={metrics.trialCount === 0 ? "empty" : "actual"}
        />
        <MetricTile
          label="Implementation capacity"
          value={`${metrics.implementationOpenTasks}/${metrics.implementationWgOnboarding}`}
          hint={metrics.implementationNote}
          href="/onboarding"
        />
        <MetricTile
          label="Avg onboarding time"
          value={
            metrics.avgOnboardingDays === null
              ? "—"
              : `${metrics.avgOnboardingDays} days`
          }
          hint={metrics.avgOnboardingNote}
          confidence={metrics.avgOnboardingDays === null ? "empty" : "actual"}
        />
      </div>

      {/* Additional existing metrics preserved */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="ARR"
          value={formatCurrency(metrics.arrCents)}
          hint="MRR × 12"
          confidence={metrics.arrConfidence}
        />
        <MetricTile
          label="Revenue"
          value={
            metrics.revenueConfidence === "empty"
              ? "—"
              : formatCurrency(metrics.revenueCents)
          }
          hint={metrics.revenueNote}
          confidence={metrics.revenueConfidence}
        />
        <MetricTile
          label="Projected ARR"
          value={formatCurrency(metrics.projectedArrCents)}
          hint={metrics.projectedArrNote}
          confidence={metrics.projectedArrConfidence}
        />
        <MetricTile
          label="Walkthrough → subscribed"
          value={formatPercent(metrics.walkthroughConversionPercent)}
          hint={metrics.walkthroughConversionNote}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Panel title="Subscription growth" className="lg:col-span-3">
          <p className="mb-4 text-sm ws-muted">
            New subscriptions started each month (last 6 months)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--htc-border)] ws-muted">
                  <th className="pb-2 pr-4 font-medium">Month</th>
                  <th className="pb-2 pr-4 font-medium">New subs</th>
                  <th className="pb-2 pr-4 font-medium">New MRR</th>
                  <th className="pb-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {metrics.subscriptionGrowth.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-[var(--htc-border)] last:border-0"
                  >
                    <td className="py-3 pr-4">{row.label}</td>
                    <td className="py-3 pr-4 font-medium">{row.newSubs}</td>
                    <td className="py-3 pr-4">
                      {row.newSubs > 0 ? formatCurrency(row.mrrCents) : "—"}
                    </td>
                    <td className="py-3 w-[40%]">
                      <div className="h-1.5 overflow-hidden rounded-sm bg-[var(--htc-linen)]">
                        <div
                          className="h-full rounded-sm bg-[var(--htc-primary)]"
                          style={{
                            width: `${(row.newSubs / maxNewSubs) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasGrowth ? (
            <p className="mt-4 text-sm ws-muted">
              No subscription growth yet — structure ready for first customers.
            </p>
          ) : null}
        </Panel>

        <Panel title="Pipeline conversion" className="lg:col-span-2">
          <p className="font-heading text-3xl text-[var(--htc-forest)]">
            {formatCurrency(metrics.pipelineValueCents)}
          </p>
          <p className="mt-2 text-sm ws-muted">
            Estimated monthly MRR across {metrics.pipelineCount} open
            opportunities (plan estimates)
          </p>
          <p className="mt-4 text-sm ws-muted">
            Close-rate assumption (60%) is an{" "}
            <span className="font-medium text-foreground">Estimate</span>{" "}
            used in Projected ARR.
          </p>
          <Link
            href="/sales"
            className="mt-5 inline-block text-sm text-[var(--htc-primary)] underline-offset-4 hover:underline"
          >
            Open pipeline →
          </Link>
          <div className="mt-6 border-t border-[var(--htc-border)] pt-5">
            <p className="ws-eyebrow">Founding Program</p>
            <p className="mt-2 text-sm leading-relaxed ws-muted">
              Founder seats and Welcome Back verification live on the Founder
              Dashboard — this page only summarizes counts.
            </p>
            <Link
              href="/founding"
              className="mt-3 inline-block text-sm text-[var(--htc-primary)] underline-offset-4 hover:underline"
            >
              Open Founder Dashboard →
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

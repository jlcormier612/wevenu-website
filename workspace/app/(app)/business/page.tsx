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
          ? "bg-[var(--soft-sage)]/45 text-[var(--forest-sage)]"
          : "bg-[var(--taupe-light)]/55 text-[var(--forest-sage)]",
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
      <p className="mt-3 font-heading text-3xl tracking-tight">{value}</p>
      {hint ? <p className="mt-2 text-sm ws-muted">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="ws-panel block p-5 hover:border-[var(--heritage-sage)]/50"
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
  const metrics = computeBusinessDashboardMetrics(getData());
  const { briefing, drafts } = loadLuvBriefing(actor);
  const maxNewSubs = Math.max(...metrics.subscriptionGrowth.map((m) => m.newSubs), 1);

  return (
    <div>
      <PageHeader
        eyebrow="Business"
        title={briefing.greeting.replace(/\.$/, "")}
        description="Company dashboard — revenue, conversion, founders, and White Glove capacity. Day-to-day work lives on Today."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs tracking-wide text-[var(--dusty-rose)]">
              <LuvMark size={11} />
              Luv is watching the board
            </span>
            <Link
              href="/today"
              className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-4 py-2.5 text-sm hover:border-[var(--heritage-sage)]"
            >
              Open Today →
            </Link>
          </div>
        }
      />

      <div className="mb-8">
        <LuvBriefingCard briefing={briefing} drafts={drafts} />
      </div>

      {/* Revenue */}
      <section className="ws-panel mb-6 overflow-hidden p-0">
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] p-6 lg:border-b-0 lg:border-r">
            <p className="ws-eyebrow">
              MRR
              <MetricTag confidence={metrics.mrrConfidence} />
            </p>
            <p className="mt-3 font-heading text-4xl tracking-tight">
              {formatCurrency(metrics.mrrCents)}
            </p>
            <p className="mt-2 text-sm ws-muted">
              {metrics.activeCustomers} subscribed+ customer
              {metrics.activeCustomers === 1 ? "" : "s"}
            </p>
          </div>
          <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] p-6 lg:border-b-0 lg:border-r">
            <p className="ws-eyebrow">
              ARR
              <MetricTag confidence={metrics.arrConfidence} />
            </p>
            <p className="mt-3 font-heading text-4xl tracking-tight">
              {formatCurrency(metrics.arrCents)}
            </p>
            <p className="mt-2 text-sm ws-muted">MRR × 12</p>
          </div>
          <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] p-6 sm:border-b-0 sm:border-r lg:border-r">
            <p className="ws-eyebrow">
              Revenue
              <MetricTag confidence={metrics.revenueConfidence} />
            </p>
            <p className="mt-3 font-heading text-4xl tracking-tight">
              {metrics.revenueConfidence === "empty"
                ? "—"
                : formatCurrency(metrics.revenueCents)}
            </p>
            <p className="mt-2 text-sm ws-muted">{metrics.revenueNote}</p>
          </div>
          <div className="p-6">
            <p className="ws-eyebrow">
              Projected ARR
              <MetricTag confidence={metrics.projectedArrConfidence} />
            </p>
            <p className="mt-3 font-heading text-4xl tracking-tight">
              {formatCurrency(metrics.projectedArrCents)}
            </p>
            <p className="mt-2 text-sm ws-muted">{metrics.projectedArrNote}</p>
          </div>
        </div>
      </section>

      {/* Health & conversion */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Walkthrough → subscribed"
          value={formatPercent(metrics.walkthroughConversionPercent)}
          hint={metrics.walkthroughConversionNote}
        />
        <MetricTile
          label="Inquiry → subscribed"
          value={formatPercent(metrics.inquiryConversionPercent)}
          hint={metrics.inquiryConversionNote}
        />
      </div>

      {/* Founders, Welcome Back, White Glove */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Founders"
          value={metrics.founderCount}
          hint={`${metrics.founderRemaining} of ${metrics.founderCapacity} remaining`}
          href="/founding"
        />
        <MetricTile
          label="Welcome Back"
          value={`${metrics.welcomeBackRequested} / ${metrics.welcomeBackApproved}`}
          hint={`${metrics.welcomeBackRequested} requested · ${metrics.welcomeBackApproved} approved${
            metrics.welcomeBackPending > 0
              ? ` · ${metrics.welcomeBackPending} pending`
              : ""
          }`}
          href="/founding"
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
        <MetricTile
          label="White Glove customers"
          value={metrics.whiteGloveCustomerCount}
          hint="Onboarding type = White Glove"
          href="/onboarding"
        />
      </div>

      {/* Capacity & onboarding */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTile
          label="Implementation capacity"
          value={`${metrics.implementationOpenTasks} / ${metrics.implementationWgOnboarding}`}
          hint={metrics.implementationNote}
          href="/onboarding"
        />
        <MetricTile
          label="Launch pipeline"
          value={`${metrics.launchGoLiveOpen} / ${metrics.launchNearCount}`}
          hint={metrics.launchNote}
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

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Panel title="Subscription growth" className="lg:col-span-3">
          <p className="mb-4 text-sm ws-muted">
            New subscriptions started each month (last 6 months)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] ws-muted">
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
                    className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_25%,transparent)] last:border-0"
                  >
                    <td className="py-3 pr-4">{row.label}</td>
                    <td className="py-3 pr-4 font-medium">{row.newSubs}</td>
                    <td className="py-3 pr-4">
                      {row.newSubs > 0 ? formatCurrency(row.mrrCents) : "—"}
                    </td>
                    <td className="py-3 w-[40%]">
                      <div className="h-1.5 overflow-hidden rounded-sm bg-[var(--taupe-light)]/50">
                        <div
                          className="h-full rounded-sm bg-[var(--heritage-sage)]"
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
        </Panel>

        <Panel title="Pipeline context" className="lg:col-span-2">
          <p className="font-heading text-3xl">
            {formatCurrency(metrics.pipelineValueCents)}
          </p>
          <p className="mt-2 text-sm ws-muted">
            Estimated monthly MRR across {metrics.pipelineCount} open
            opportunities (plan estimates)
          </p>
          <p className="mt-4 text-sm ws-muted">
            Close-rate assumption (60%) is an{" "}
            <span className="font-medium text-[var(--forest-sage)]">Estimate</span>{" "}
            used in Projected ARR.
          </p>
          <Link
            href="/sales"
            className="mt-5 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Open pipeline →
          </Link>
          <div className="mt-6 border-t border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] pt-5">
            <p className="ws-eyebrow">Founding Program</p>
            <p className="mt-2 text-sm leading-relaxed ws-muted">
              Founder seats and Welcome Back verification live on the Founder
              Dashboard — this page only summarizes counts.
            </p>
            <Link
              href="/founding"
              className="mt-3 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
            >
              Open Founder Dashboard →
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";

import { Greeting } from "@/components/dashboard/greeting";
import { MilestoneToast } from "@/components/dashboard/milestone-toast";
import { DashboardLuvIntro } from "@/components/dashboard/luv-intro";
import { YourNextStepsCard } from "@/components/dashboard/getting-started";
import { DigestCallout } from "@/components/dashboard/digest-callout";
import { AttentionList } from "@/components/dashboard-system/attention-list";
import { StatTile, StatTileGrid } from "@/components/dashboard-system/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard/service";
import { excludeTodayFocusFromNextSteps, VENUE_NEXT_STEPS_CAP } from "@/lib/dashboard/venue-next-steps";
import { clientListFilterHref } from "@/lib/clients/list-filters";
import {
  classifyBriefingItems, classifyUpcomingItems,
  collectCrossSectionSubjects, excludeByCrossSectionSubject,
} from "@/lib/dashboard-system/decision-engine";
import type { ClassifiedItem, Priority } from "@/lib/dashboard-system/decision-engine";
import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
import { getOutstandingBalance } from "@/lib/metrics/revenue";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<{ milestone?: string }> };

const PRIORITY_SEVERITY: Record<Priority, "critical" | "warning" | undefined> = {
  critical: "critical",
  needs_attention_today: "warning",
  upcoming: undefined,
  informational: undefined,
};

/**
 * Venue Dashboard — operational front door.
 *
 * Section jobs (must stay distinct):
 *   1. Today's Focus — what requires attention TODAY (NOW queue)
 *   2. Your Next Steps — what to do AFTER today's urgent work (NEXT queue)
 *   3. Upcoming — what's coming (awareness, not another task queue)
 *
 * The same underlying entity must never appear across Today's Focus, Your
 * Next Steps, or Upcoming — see excludeTodayFocusFromNextSteps and
 * excludeByCrossSectionSubject (shared type:id identity keys; date
 * partitioning alone is not enough).
 *
 * The former shortcut grid was removed: every shortcut duplicated primary nav
 * or contextual creation. "+ New Lead" remains as the header primary action.
 * No Bookings nav item — booking is a lifecycle concept, not a domain object.
 */
export default async function DashboardPage({ searchParams }: Props) {
  const [data] = await Promise.all([getDashboardData(), searchParams]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground">Dashboard unavailable.</p>
      </div>
    );
  }

  // Precedence: Today's Focus (NOW) is never filtered — it's the highest-
  // priority section and every other section is filtered against it.
  const allFocusItems = classifyBriefingItems(data);
  const focusItems = allFocusItems.slice(0, 10);

  // NEXT queue: exclude anything already claimed by Today's Focus, then cap
  // for display. data.nextSteps arrives at a larger candidate cap
  // (lib/dashboard/service.ts) specifically so this filter can't quietly
  // shrink what's visible below VENUE_NEXT_STEPS_CAP real, distinct items.
  const allNextSteps = excludeTodayFocusFromNextSteps(
    data.nextSteps,
    allFocusItems,
    data.todayIso,
  );
  const nextSteps = allNextSteps.slice(0, VENUE_NEXT_STEPS_CAP);

  // COMING queue: exclude anything already claimed by Today's Focus or by
  // the Next Steps actually being shown (not the full candidate set — an
  // item Next Steps itself didn't have room for is still fair game for
  // Upcoming to surface).
  const claimedSubjects = collectCrossSectionSubjects(allFocusItems);
  for (const step of nextSteps) claimedSubjects.add(step.subjectKey);
  const upcomingItems = excludeByCrossSectionSubject(classifyUpcomingItems(data), claimedSubjects).slice(0, 10);

  const outstandingBalance = await getOutstandingBalance().catch(() => null);

  const luvEntry = selectLuvDashboardEntry({
    focusItems,
    observations: [...data.luvObservations, ...data.insightObservations],
    recommendations: data.recommendations,
  });

  return (
    <div className="space-y-8">
      <MilestoneToast milestone={data.nextPendingMilestone} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Greeting venueName={data.venueName} ownerFirstName={data.ownerFirstName} />
        <Button render={<Link href="/leads/new" />} className="sm:shrink-0">
          + New Lead
        </Button>
      </div>

      <DashboardLuvIntro
        show={data.showLuvIntro}
        setupHref={data.onboarding.show ? "/setup-hub" : "/setup-hub"}
      />
      {data.showDigestCallout && <DigestCallout />}

      {/* 1. NOW — overdue, due today, urgent operational attention */}
      <section>
        <AttentionList
          icon={<CalendarClock className="h-4 w-4 text-primary" />}
          title="Today's Focus"
          description="What requires attention today."
          headerRight={allFocusItems.length > focusItems.length ? <span className="text-xs text-muted-foreground">{focusItems.length} of {allFocusItems.length}</span> : undefined}
          items={focusItems}
          getKey={(i) => i.id}
          emptyState={
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing urgent today — you&apos;re all caught up.
            </p>
          }
          renderRow={(item) => <ClassifiedRow item={item} />}
        />
      </section>

      {/* Luv interprets Today's Focus — not a second task list */}
      {luvEntry && (
        <section>
          <Card className="border-rose-200/40" style={{ background: "color-mix(in oklch, var(--destructive) 2%, var(--card))" }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span aria-hidden>💗</span> Luv
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <p className="text-sm text-foreground">{luvEntry.message}</p>
              {luvEntry.suggestion && (
                <p className="text-sm text-muted-foreground">{luvEntry.suggestion}</p>
              )}
              <Link
                href={luvEntry.actionHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {luvEntry.actionLabel}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* 2. NEXT — actionable follow-ups that are not today's urgent work */}
      {nextSteps.length > 0 && (
        <section id="your-next-steps">
          <YourNextStepsCard items={nextSteps} today={data.todayIso} />
        </section>
      )}

      {/* 3. COMING — awareness of future events/dates/milestones, not a task queue */}
      <section>
        <AttentionList
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
          title="Upcoming"
          description="What's coming — events, dates, and milestones."
          items={upcomingItems}
          getKey={(i) => i.id}
          emptyState={
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing on the horizon yet.
            </p>
          }
          renderRow={(item) => <ClassifiedRow item={item} />}
        />
      </section>

      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Business Snapshot</p>
        <StatTileGrid className="sm:grid-cols-3">
          <StatTile
            layout="label-top" label="Active Leads" sub="Still in play"
            value={data.activeLeadCount}
            className="rounded-xl border bg-card p-3" href="/leads"
          />
          <StatTile
            layout="label-top" label="Payments to Watch" sub="Outstanding balance"
            value={outstandingBalance != null ? formatCurrencyShort(outstandingBalance) : "—"}
            severity={outstandingBalance && outstandingBalance > 0 ? "warning" : undefined}
            className="rounded-xl border bg-card p-3" href="/payments"
          />
          <StatTile
            layout="label-top" label="Upcoming"
            value={data.clientListCounts.upcoming}
            className="rounded-xl border bg-card p-3" href={clientListFilterHref("upcoming")}
          />
        </StatTileGrid>
      </section>

      <section>
        <Link
          href="/reporting"
          className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
        >
          <span className="font-medium text-foreground">View full Reporting</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>
    </div>
  );
}

function ClassifiedRow({ item }: { item: ClassifiedItem }): ReactNode {
  const severity = item.rightSeverity ?? PRIORITY_SEVERITY[item.priority];
  const colorClass = severity === "critical" ? "text-destructive" : severity === "warning" ? "text-warning-foreground" : "text-muted-foreground";
  return (
    <Link
      href={item.href}
      className="flex items-start justify-between gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
        {item.detail && <p className="text-xs text-muted-foreground truncate">{item.detail}</p>}
      </div>
      {item.rightLabel && (
        <div className="shrink-0 pt-0.5">
          <span className={`text-xs font-medium ${colorClass}`}>{item.rightLabel}</span>
        </div>
      )}
    </Link>
  );
}

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

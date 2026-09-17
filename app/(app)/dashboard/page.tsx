import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";

import { Greeting } from "@/components/dashboard/greeting";
import { MilestoneToast } from "@/components/dashboard/milestone-toast";
import { DashboardLuvIntro } from "@/components/dashboard/luv-intro";
import { DashboardLuvEntryCard } from "@/components/dashboard/luv-dashboard-entry";
import { BusinessSnapshotSection } from "@/components/dashboard/business-snapshot";
import { AttentionList } from "@/components/dashboard-system/attention-list";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard/service";
import { getBusinessSnapshot } from "@/lib/dashboard/business-snapshot";
import {
  classifyBriefingItems, classifyUpcomingItems,
  collectCrossSectionSubjects, excludeByCrossSectionSubject,
} from "@/lib/dashboard-system/decision-engine";
import type { ClassifiedItem, Priority } from "@/lib/dashboard-system/decision-engine";
import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<{ milestone?: string }> };

const PRIORITY_SEVERITY: Record<Priority, "critical" | "warning" | undefined> = {
  critical: "critical",
  needs_attention_today: "warning",
  upcoming: undefined,
  informational: undefined,
};

/**
 * Venue Dashboard — concise awareness / briefing surface.
 *
 * Section jobs (must stay distinct):
 *   1. Today's Focus — what requires attention TODAY (actionable NOW)
 *   2. Coming up — what's coming (awareness, not another task queue)
 *   3. Business Snapshot — compact business-state numbers (not Reports)
 *
 * Owning surfaces do the work (Leads, Inbox/Conversation, Contracts,
 * Invoices, Tours, Task Center). Dashboard does not reproduce their queues.
 * "+ New Lead" remains as the header primary action.
 */
export default async function DashboardPage({ searchParams }: Props) {
  const [data, snapshot] = await Promise.all([
    getDashboardData(),
    getBusinessSnapshot(),
    searchParams,
  ]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground">Dashboard unavailable.</p>
      </div>
    );
  }

  const allFocusItems = classifyBriefingItems(data);
  const focusItems = allFocusItems.slice(0, 10);

  const claimedSubjects = collectCrossSectionSubjects(allFocusItems);
  const upcomingItems = excludeByCrossSectionSubject(classifyUpcomingItems(data), claimedSubjects).slice(0, 10);

  const luvEntry = data.luvObservationsEnabled
    ? selectLuvDashboardEntry({
        focusItems,
        observations: [...data.luvObservations, ...data.insightObservations],
        recommendations: data.recommendations,
      })
    : null;

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

      {luvEntry && <DashboardLuvEntryCard entry={luvEntry} />}

      <section>
        <AttentionList
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
          title="Coming up"
          description="Events in the next 60 days."
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

      {snapshot && <BusinessSnapshotSection cards={snapshot.cards} />}

      <section>
        <Link
          href="/reporting"
          className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
        >
          <span className="font-medium text-foreground">View Reports</span>
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

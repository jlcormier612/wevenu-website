import type { Metadata } from "next";
import Link from "next/link";

import { ClientEventsWidget } from "@/components/dashboard/client-events-widget";
import { OverduePaymentsWidget, UpcomingPaymentsWidget } from "@/components/dashboard/payments-widget";
import { FollowupsWidget } from "@/components/dashboard/followups-widget";
import { GettingStartedCard } from "@/components/dashboard/getting-started";
import { Greeting } from "@/components/dashboard/greeting";
import { LuvWidget } from "@/components/dashboard/luv-widget";
import { MomentumWidget } from "@/components/dashboard/momentum-widget";
import { KeyDatesWidget } from "@/components/dashboard/key-dates-widget";
import { NeedsAttentionWidget } from "@/components/dashboard/needs-attention";
import { PipelineSnapshot } from "@/components/dashboard/pipeline-snapshot";
import { RecentActivityWidget } from "@/components/dashboard/recent-activity-widget";
import { RecentBookingsWidget } from "@/components/dashboard/recent-bookings-widget";
import { StatBar } from "@/components/dashboard/stat-bar";
import { TasksWidget } from "@/components/dashboard/tasks-widget";
import { UpcomingToursWidget } from "@/components/dashboard/upcoming-tours";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard/service";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<{ milestone?: string }> };

/**
 * Today Dashboard — the venue owner's morning briefing.
 * All widget data is fetched in three parallel queries (leads, tasks,
 * activities) then shaped client-side with no additional round-trips.
 */
export default async function DashboardPage({ searchParams }: Props) {
  const [data, { milestone }] = await Promise.all([getDashboardData(), searchParams]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground">Dashboard unavailable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Greeting venueName={data.venueName} ownerFirstName={data.ownerFirstName} />
        <Button render={<Link href="/leads/new" />} className="sm:shrink-0">
          + New Inquiry
        </Button>
      </div>

      {/* 💗 Luv — venue assistant (observations + trend intelligence) */}
      <LuvWidget observations={data.luvObservations} trendObservations={data.trendObservations} />

      {/* 💗 Momentum intelligence — who needs attention today? */}
      <MomentumWidget
        heatingUp={data.momentumSegments.heatingUp}
        coolingOff={data.momentumSegments.coolingOff}
      />

      {/* Getting Started onboarding card (new venues only) */}
      {data.onboarding.show && (
        <GettingStartedCard onboarding={data.onboarding} milestone={milestone} />
      )}

      {/* Quick-count stat bar */}
      <StatBar data={data} />

      {/* ── Payments ───────────────────────────────────────────────────── */}
      {(data.overduePayments.length > 0 || data.upcomingPayments.length > 0) && (
        <>
          <div className="flex items-center gap-3">
            <p className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Payments</p>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <OverduePaymentsWidget payments={data.overduePayments} />
            <UpcomingPaymentsWidget payments={data.upcomingPayments} />
          </div>
        </>
      )}

      {/* ── Booked Clients ─────────────────────────────────────────────── */}
      {data.totalClients > 0 && (
        <>
          <div className="flex items-center gap-3">
            <p className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Booked Clients
            </p>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <ClientEventsWidget events={data.upcomingEvents} />
            </div>
            <div className="space-y-6">
              <RecentBookingsWidget bookings={data.recentBookings} />
              <KeyDatesWidget keyDates={data.upcomingKeyDates} />
            </div>
          </div>
        </>
      )}

      {/* ── Pipeline ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Pipeline
        </p>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — primary urgency */}
        <div className="space-y-6 lg:col-span-2">
          <NeedsAttentionWidget leads={data.needsAttention} />
          <FollowupsWidget leads={data.followupsDue} todayIso={data.todayIso} />
          <UpcomingToursWidget leads={data.upcomingTours} />
        </div>

        {/* Right column — pipeline + tasks */}
        <div className="space-y-6">
          <PipelineSnapshot
            stages={data.pipelineStages}
            totalLeads={data.totalLeads}
          />
          <TasksWidget tasks={data.openTasks} openTaskCount={data.openTaskCount} />
        </div>
      </div>

      {/* Full-width recent activity */}
      <RecentActivityWidget activities={data.recentActivity} />
    </div>
  );
}

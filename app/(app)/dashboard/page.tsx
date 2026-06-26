import type { Metadata } from "next";
import Link from "next/link";

import { FollowupsWidget } from "@/components/dashboard/followups-widget";
import { GettingStartedCard } from "@/components/dashboard/getting-started";
import { Greeting } from "@/components/dashboard/greeting";
import { NeedsAttentionWidget } from "@/components/dashboard/needs-attention";
import { PipelineSnapshot } from "@/components/dashboard/pipeline-snapshot";
import { RecentActivityWidget } from "@/components/dashboard/recent-activity-widget";
import { StatBar } from "@/components/dashboard/stat-bar";
import { TasksWidget } from "@/components/dashboard/tasks-widget";
import { UpcomingToursWidget } from "@/components/dashboard/upcoming-tours";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard/service";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Today Dashboard — the venue owner's morning briefing.
 * All widget data is fetched in three parallel queries (leads, tasks,
 * activities) then shaped client-side with no additional round-trips.
 */
export default async function DashboardPage() {
  const data = await getDashboardData();

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
        <Greeting venueName={data.venueName} />
        <Button render={<Link href="/leads/new" />} className="sm:shrink-0">
          + New Inquiry
        </Button>
      </div>

      {/* Getting Started onboarding card (new venues only) */}
      {data.onboarding.show && (
        <GettingStartedCard onboarding={data.onboarding} />
      )}

      {/* Quick-count stat bar */}
      <StatBar data={data} />

      {/* Main 2-column grid */}
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

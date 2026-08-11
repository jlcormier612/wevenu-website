import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle, CalendarClock, ChevronRight, FilePlus, MessageSquarePlus,
  PartyPopper, Receipt, UserPlus, CalendarPlus, ClipboardList,
} from "lucide-react";

import { Greeting } from "@/components/dashboard/greeting";
import { MilestoneToast } from "@/components/dashboard/milestone-toast";
import { DashboardLuvIntro } from "@/components/dashboard/luv-intro";
import { GettingStartedCard } from "@/components/dashboard/getting-started";
import { DigestCallout } from "@/components/dashboard/digest-callout";
import { AttentionList } from "@/components/dashboard-system/attention-list";
import { StatTile, StatTileGrid } from "@/components/dashboard-system/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard/service";
import {
  classifyBriefingItems, classifyDashboardItems, classifyUpcomingItems, sortByPriority,
} from "@/lib/dashboard-system/decision-engine";
import type { ClassifiedItem, Priority } from "@/lib/dashboard-system/decision-engine";
import { getVenueHealth } from "@/lib/metrics/health";
import { getBookingsThisMonth } from "@/lib/metrics/booking";
import { getOutstandingBalance, getGrossBookedRevenue } from "@/lib/metrics/revenue";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<{ milestone?: string }> };

const PRIORITY_SEVERITY: Record<Priority, "critical" | "warning" | undefined> = {
  critical: "critical",
  needs_attention_today: "warning",
  upcoming: undefined,
  informational: undefined,
};

/**
 * Venue Dashboard Reconstruction, Phase 1 — replaces the prior 21-widget
 * assembly with the five certified sections from docs/dashboard-component-
 * system-architecture.md + docs/dashboard-luv-experience-architecture.md:
 * Morning Briefing, Today's Attention, Upcoming, Business Snapshot, Quick
 * Actions — plus one minimal Luv entry point and Reports navigation,
 * exactly as scoped. See docs/venue-dashboard-reconstruction-phase1.md
 * for the full before/after comparison and what moved where.
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

  // ── Decision Engine: classify + prioritize (see lib/dashboard-system/decision-engine.ts) ──
  const briefingItems = classifyBriefingItems(data);
  const allAttentionItems = sortByPriority(classifyDashboardItems(data));
  const attentionItems = allAttentionItems.slice(0, 10);
  const upcomingItems = classifyUpcomingItems(data).slice(0, 10);

  // ── Business Snapshot (canonical metrics only — lib/metrics/registry.ts) ──
  const [venueHealth, bookingsThisMonth, outstandingBalance, grossRevenue] = await Promise.all([
    getVenueHealth().catch(() => null),
    getBookingsThisMonth().catch(() => []),
    getOutstandingBalance().catch(() => null),
    getGrossBookedRevenue().catch(() => null),
  ]);

  // ── Luv entry point: at most one observation, one recommendation, one action ──
  const topObservation = data.luvObservations[0] ?? data.insightObservations[0] ?? null;
  const topRecommendation = data.recommendations[0] ?? null;

  return (
    <div className="space-y-8">
      <MilestoneToast milestone={data.nextPendingMilestone} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Greeting venueName={data.venueName} ownerFirstName={data.ownerFirstName} />
        <Button render={<Link href="/leads/new" />} className="sm:shrink-0">
          + New Lead
        </Button>
      </div>

      <DashboardLuvIntro show={data.showLuvIntro} />
      {data.onboarding.show && (
        <GettingStartedCard onboarding={data.onboarding} milestone={milestone} venueName={data.venueName} />
      )}
      {data.showDigestCallout && <DigestCallout />}

      {/* 1. Morning Briefing — Critical + Needs Attention Today + today's
          Upcoming only, nothing historical or informational, max 5. */}
      <section>
        <AttentionList
          icon={<CalendarClock className="h-4 w-4 text-primary" />}
          title="Morning Briefing"
          description="What matters today, in order."
          items={briefingItems}
          getKey={(i) => i.id}
          emptyState={
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing urgent today — you&apos;re all caught up. 🌿
            </p>
          }
          renderRow={(item) => <ClassifiedRow item={item} />}
        />
      </section>

      {/* 2. Today's Attention — actionable work only, max 10, sorted by
          Decision Engine priority. */}
      <section>
        <AttentionList
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          title="Today's Attention"
          description="Everything that needs a decision or an action right now."
          headerRight={allAttentionItems.length > 0 ? <span className="text-xs text-muted-foreground">{attentionItems.length} of {allAttentionItems.length}</span> : undefined}
          items={attentionItems}
          getKey={(i) => i.id}
          emptyState={
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing needs your attention. Great place to be.
            </p>
          }
          renderRow={(item) => <ClassifiedRow item={item} />}
        />
      </section>

      {/* 3. Upcoming — one merged component: tours, events, payments, key
          dates, calendar milestones. Never four separate widgets. */}
      <section>
        <AttentionList
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
          title="Upcoming"
          description="What's coming up, across everything."
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

      {/* 4. Business Snapshot — canonical Stat Tiles only, no charts, no trend analysis. */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Business Snapshot</p>
        <StatTileGrid className="sm:grid-cols-3 lg:grid-cols-6">
          {/* Work Package R2 — this tile previously linked to /analytics, which
              never actually rendered Venue Health anywhere (confirmed by
              reading every /analytics card — that page showed Client/Relationship
              Health, a different canonical metric). Left unlinked rather than
              pointed at a redirect that lands somewhere equally unrelated. */}
          {/* Work Package D8 — Bookings is scoped "this month" while Revenue
              sat right next to it with no window at all (all-time under the
              hood), so a venue owner could easily misread them as covering
              the same period. Each figure's own time scope is a deliberate,
              already-certified choice (a balance has no period to begin
              with; all-time revenue is the more useful permanent snapshot
              vs. a resetting monthly figure) — the fix is making the scope
              visible via `sub`, not changing which window any metric uses. */}
          <StatTile layout="label-top" label="Venue Health" value={venueHealth ? `${venueHealth.score}` : "—"} className="rounded-xl border bg-card p-3" />
          <StatTile layout="label-top" label="Bookings" sub="This month" value={bookingsThisMonth.length} className="rounded-xl border bg-card p-3" href="/reporting/bookings" />
          <StatTile layout="label-top" label="Revenue" sub="All time" value={grossRevenue != null ? formatCurrencyShort(grossRevenue) : "—"} className="rounded-xl border bg-card p-3" href="/reporting/revenue" />
          <StatTile layout="label-top" label="Pipeline" value={data.totalLeads} className="rounded-xl border bg-card p-3" href="/leads" />
          <StatTile layout="label-top" label="Outstanding" sub="Current balance" value={outstandingBalance != null ? formatCurrencyShort(outstandingBalance) : "—"} severity={outstandingBalance && outstandingBalance > 0 ? "warning" : undefined} className="rounded-xl border bg-card p-3" href="/payments" />
          <StatTile layout="label-top" label="Upcoming Events" value={data.upcomingEvents.length} className="rounded-xl border bg-card p-3" href="/events" />
        </StatTileGrid>
      </section>

      {/* 5. Quick Actions — one canonical action area, max 8. */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/leads/new" icon={UserPlus} label="New Lead" />
          <QuickAction href="/clients/new" icon={PartyPopper} label="New Booking" />
          <QuickAction href="/contracts/new" icon={FilePlus} label="New Contract" />
          <QuickAction href="/invoices/new" icon={Receipt} label="New Invoice" />
          <QuickAction href="/events/new" icon={CalendarPlus} label="New Event" />
          <QuickAction href="/messaging" icon={MessageSquarePlus} label="Messages" />
          <QuickAction href="/tasks" icon={ClipboardList} label="Tasks" />
          <QuickAction href="/calendar" icon={CalendarClock} label="Calendar" />
        </div>
      </section>

      {/* Luv entry point — at most one observation, one recommendation, one
          action. No placeholder AI: renders nothing if Luv has nothing to say. */}
      {(topObservation || topRecommendation) && (
        <section>
          <Card className="border-rose-200/40" style={{ background: "color-mix(in oklch, var(--destructive) 2%, var(--card))" }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span aria-hidden>💗</span> Luv
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {topObservation && (
                <p className="text-sm text-foreground">{topObservation.message}</p>
              )}
              {topRecommendation && (
                <p className="text-sm text-muted-foreground">{topRecommendation.title}</p>
              )}
              <Link
                href={topRecommendation?.ctas[0]?.type === "navigate" ? topRecommendation.ctas[0].target : (topObservation?.link ?? "/leads")}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {topRecommendation?.ctas[0]?.label ?? topObservation?.actionLabel ?? "View"}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Reports — navigation only, no report content on the Dashboard. */}
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

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
    >
      <Icon className="h-5 w-5 text-primary" />
      {label}
    </Link>
  );
}

/** Shared row renderer for all three Attention List instances above — one visual treatment for every classified item, reading `severity` from the Decision Engine's own priority assignment, never inventing its own urgency styling (architecture doc §7). */
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

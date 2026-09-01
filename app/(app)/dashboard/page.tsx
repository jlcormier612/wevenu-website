import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarClock, ChevronRight, FilePlus, MessageSquarePlus,
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
  classifyBriefingItems, classifyUpcomingItems,
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
 * Venue Dashboard Reconstruction, Phase 1 — replaces the prior 21-widget
 * assembly with the certified sections from docs/dashboard-component-
 * system-architecture.md + docs/dashboard-luv-experience-architecture.md:
 * Today's Focus, Upcoming, Business Snapshot, Quick Actions — plus one
 * minimal Luv entry point and Reports navigation, exactly as scoped. See
 * docs/venue-dashboard-reconstruction-phase1.md for the full before/after
 * comparison and what moved where.
 *
 * Deduplication pass: Morning Briefing and Today's Attention rendered the same
 * classification twice, so the two collapsed into Today's Focus. Each section
 * now has exactly one job — Today's Focus is what needs attention now, Upcoming
 * is strictly what comes later, and Luv interprets rather than re-lists.
 *
 * Information-architecture pass: the Dashboard is the operational front door
 * ("what do I need to know or do right now?"), not a set of miniature Reports/
 * Calendar/Tasks/Payments panels — those pages stay the systems of record. So
 * Luv moved up beneath the list it interprets, and Business Snapshot dropped
 * from six tiles to three operational ones (Active Leads, Payments to Watch,
 * Upcoming Events). Bookings/Revenue were Reports excerpts linking straight to
 * Reports; Venue Health showed a context-free number off a computation with a
 * known data-quality problem. Neither metric was deleted — only removed from
 * this surface.
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
  // One classification, one section. Today's Focus owns everything actionable
  // now (including anything dated today); Upcoming owns strictly later dates.
  const allFocusItems = classifyBriefingItems(data);
  const focusItems = allFocusItems.slice(0, 10);
  const upcomingItems = classifyUpcomingItems(data).slice(0, 10);

  // ── Business Snapshot (canonical metrics only — lib/metrics/registry.ts) ──
  const outstandingBalance = await getOutstandingBalance().catch(() => null);

  // ── Luv entry point: interpretation, not a second copy of Today's Focus ──
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
        setupHref={data.onboarding.show ? "#getting-started" : "/setup-hub"}
      />
      {data.showDigestCallout && <DigestCallout />}

      {/* 1. Today's Focus — the one section for work that needs attention now:
          Critical + Needs Attention Today + anything dated today. Previously
          this rendered as Morning Briefing above a separate Today's Attention
          list built from the same classification, so the two sections restated
          each other; Today's Attention is gone and this one carries the whole
          set, reporting overflow rather than silently truncating at five. */}
      <section>
        <AttentionList
          icon={<CalendarClock className="h-4 w-4 text-primary" />}
          title="Today's Focus"
          description="What matters today, in order."
          headerRight={allFocusItems.length > focusItems.length ? <span className="text-xs text-muted-foreground">{focusItems.length} of {allFocusItems.length}</span> : undefined}
          items={focusItems}
          getKey={(i) => i.id}
          emptyState={
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing urgent today — you&apos;re all caught up. 🌿
            </p>
          }
          renderRow={(item) => <ClassifiedRow item={item} />}
        />
      </section>

      {/* 2. Luv — directly beneath Today's Focus, because Luv's job is to
          interpret that list, and an interpretation separated from what it
          interprets reads as an unrelated aside. One interpretation and one
          offered next step, never a second enumeration: lib/dashboard-system/
          luv-entry.ts drops any observation whose subject is already a
          visible Today's Focus row and falls back to an aggregate read of
          that list. No placeholder AI — renders nothing if Luv has nothing
          to add beyond what is already on screen. */}
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

      {/* 3. Upcoming — one merged component: tours, events, payments, key
          dates, calendar milestones. Never four separate widgets. Strictly
          later than today, so it cannot repeat a Today's Focus row. */}
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

      {/* 4. Business Snapshot — three operational tiles, each with one clear
          definition and one destination that is the system of record for it.
          Bookings/Revenue moved out entirely: both were miniature Reports
          that linked straight to /reporting, which is where that question
          gets answered properly. Venue Health also moved out — it rendered a
          bare 0-100 number with none of the tier/strengths/gaps context that
          makes it interpretable, and its underlying computation still scores
          pipeline activity off the deprecated leads.status column. The
          score itself (lib/metrics/health.ts, compute_venue_health_score())
          is untouched and can return once that data-quality issue is fixed. */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Business Snapshot</p>
        <StatTileGrid className="sm:grid-cols-3">
          {/* Active Leads, not "Pipeline": the old tile read data.totalLeads,
              every lead ever created including booked/lost/won/cancelled, and
              labelled it Pipeline. This counts only leads still in play. */}
          <StatTile
            layout="label-top" label="Active Leads" sub="Still in play"
            value={data.activeLeadCount}
            className="rounded-xl border bg-card p-3" href="/leads"
          />
          {/* Payments to Watch is the canonical Outstanding Balance metric
              (Gross Booked Revenue − Payments Collected, lib/metrics/
              registry.ts) under an operational name. Deliberately NOT
              data.overduePayments, which counts raw overdue line items — a
              second, differently-scoped answer to "what is outstanding" with
              no shared id to dedupe against the first. One definition only. */}
          <StatTile
            layout="label-top" label="Payments to Watch" sub="Outstanding balance"
            value={outstandingBalance != null ? formatCurrencyShort(outstandingBalance) : "—"}
            severity={outstandingBalance && outstandingBalance > 0 ? "warning" : undefined}
            className="rounded-xl border bg-card p-3" href="/payments"
          />
          <StatTile
            layout="label-top" label="Upcoming Events" sub="Next 60 days"
            value={data.upcomingEventCount}
            className="rounded-xl border bg-card p-3" href="/events"
          />
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

      {/* Getting Started — onboarding, not operational, so it sits after the
          operational sections rather than ahead of them. docs/dashboard-
          luv-experience-architecture.md §6 classifies this row "n/a —
          onboarding, not operational" and lists it last in the permanent
          structure, naming the actionable-work section "the one section the
          Dashboard exists for" — Today's Focus, since the deduplication pass.
          The Phase 1 reconstruction kept this card explicitly because it does
          "not compete for 'what matters today' attention" (docs/venue-
          dashboard-reconstruction-phase1.md §6) but left its old placement
          untouched, where it pushed the operational sections below the fold.
          Still disappears entirely at 100% via data.onboarding.show. */}
      {data.onboarding.show && (
        <section>
          <GettingStartedCard onboarding={data.onboarding} milestone={milestone} venueName={data.venueName} />
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

/** Shared row renderer for both Attention List instances above — one visual treatment for every classified item, reading `severity` from the Decision Engine's own priority assignment, never inventing its own urgency styling (architecture doc §7). */
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

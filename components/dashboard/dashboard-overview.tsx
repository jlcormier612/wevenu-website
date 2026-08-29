import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FilePlus2,
  Heart,
  MessageSquare,
  PartyPopper,
  Plus,
  Receipt,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import { AttentionList } from "@/components/dashboard-system/attention-list";
import { StatTile, StatTileGrid } from "@/components/dashboard-system/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/lib/dashboard/types";
import type { ClassifiedItem, Priority } from "@/lib/dashboard-system/decision-engine";
import { classifyBriefingItems, classifyDashboardItems, classifyUpcomingItems, sortByPriority } from "@/lib/dashboard-system/decision-engine";

const PRIORITY_SEVERITY: Record<Priority, "critical" | "warning" | undefined> = {
  critical: "critical",
  needs_attention_today: "warning",
  upcoming: undefined,
  informational: undefined,
};

type Props = {
  data: DashboardData;
  venueHealthScore: number | null;
  bookingsThisMonth: number;
  outstandingBalance: number | null;
  grossRevenue: number | null;
};

export function DashboardOverview({
  data,
  venueHealthScore,
  bookingsThisMonth,
  outstandingBalance,
  grossRevenue,
}: Props) {
  const briefingItems = classifyBriefingItems(data);
  const attentionItems = sortByPriority(classifyDashboardItems(data));
  const upcomingItems = classifyUpcomingItems(data).slice(0, 6);
  const todayEvents = data.upcomingEvents.filter((event) => event.eventDate === data.todayIso);
  const topObservation = data.luvObservations[0] ?? data.insightObservations[0] ?? null;
  const topRecommendation = data.recommendations[0] ?? null;

  return (
    <div className="space-y-7 pb-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Your venue at a glance</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            Good {timeOfDay()}, {data.ownerFirstName || "there"} <span aria-hidden>☀️</span>
          </h1>
          <p className="mt-1.5 text-base text-muted-foreground">
            Here&apos;s what&apos;s happening at {data.venueName} today.
          </p>
        </div>
        <Button render={<Link href="/leads/new" />} className="rounded-full px-5 shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Lead
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={CalendarDays}
          eyebrow="Today"
          title="Today&apos;s Events"
          value={todayEvents.length}
          detail={todayEvents[0]?.name ?? "No events scheduled"}
          foot={todayEvents[0]?.startTime ? `Starts ${formatTime(todayEvents[0].startTime)}` : "View your calendar"}
          href="/calendar"
          tone="sage"
        />
        <SummaryCard
          icon={Users}
          eyebrow="Sales"
          title="New Leads"
          value={data.newLeadCount}
          detail="New inquiries"
          foot="View your pipeline"
          href="/leads"
          tone="blush"
        />
        <SummaryCard
          icon={ClipboardCheck}
          eyebrow="Work"
          title="Open Tasks"
          value={data.openTaskCount}
          detail={data.openTaskCount === 1 ? "1 item to finish" : "Items to finish"}
          foot="Stay on top of your work"
          href="/tasks"
          tone="cream"
        />
        <SummaryCard
          icon={DollarSign}
          eyebrow="Business"
          title="Booked Revenue"
          value={grossRevenue != null ? formatCurrencyShort(grossRevenue) : "—"}
          detail="All time"
          foot={`${bookingsThisMonth} booking${bookingsThisMonth === 1 ? "" : "s"} this month`}
          href="/reporting/revenue"
          tone="green"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <section>
          <AttentionList
            icon={<CalendarClock className="h-4 w-4 text-primary" />}
            title="Morning Briefing"
            description="Your snapshot of what matters right now."
            items={briefingItems.slice(0, 5)}
            getKey={(item) => item.id}
            emptyState={<EmptyMessage text="Nothing urgent today — you&apos;re all caught up. 🌿" />}
            renderRow={(item) => <ClassifiedRow item={item} />}
          />
        </section>

        <LuvCard observation={topObservation?.message ?? null} recommendation={topRecommendation?.title ?? null} href={topRecommendation?.ctas[0]?.target ?? topObservation?.link ?? "/leads"} label={topRecommendation?.ctas[0]?.label ?? topObservation?.actionLabel ?? "Take a look"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <section>
          <AttentionList
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            title="Today&apos;s Attention"
            description="Focus on the things that need a decision or action."
            headerRight={attentionItems.length > 0 ? <span className="text-xs text-muted-foreground">{Math.min(attentionItems.length, 5)} of {attentionItems.length}</span> : undefined}
            items={attentionItems.slice(0, 5)}
            getKey={(item) => item.id}
            emptyState={<EmptyMessage text="Nothing needs your attention. Great place to be." />}
            renderRow={(item) => <ClassifiedRow item={item} />}
          />
        </section>

        <section>
          <AttentionList
            icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
            title="Upcoming"
            description="What&apos;s coming up across your venue."
            items={upcomingItems}
            getKey={(item) => item.id}
            emptyState={<EmptyMessage text="Nothing on the horizon yet." />}
            renderRow={(item) => <ClassifiedRow item={item} />}
          />
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Business Snapshot</p>
            <p className="mt-1 text-sm text-muted-foreground">The numbers worth knowing at a glance.</p>
          </div>
          <Link href="/reporting" className="hidden text-xs font-medium text-primary hover:underline sm:block">View reporting →</Link>
        </div>
        <StatTileGrid className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile layout="label-top" label="Venue Health" value={venueHealthScore != null ? `${venueHealthScore}` : "—"} className="rounded-2xl border bg-card p-4 shadow-sm" />
          <StatTile layout="label-top" label="Bookings" sub="This month" value={bookingsThisMonth} href="/reporting/bookings" className="rounded-2xl border bg-card p-4 shadow-sm" />
          <StatTile layout="label-top" label="Revenue" sub="All time" value={grossRevenue != null ? formatCurrencyShort(grossRevenue) : "—"} href="/reporting/revenue" className="rounded-2xl border bg-card p-4 shadow-sm" />
          <StatTile layout="label-top" label="Pipeline" sub="Open leads" value={data.totalLeads} href="/leads" className="rounded-2xl border bg-card p-4 shadow-sm" />
          <StatTile layout="label-top" label="Outstanding" sub="Current balance" value={outstandingBalance != null ? formatCurrencyShort(outstandingBalance) : "—"} severity={outstandingBalance && outstandingBalance > 0 ? "warning" : undefined} href="/payments" className="rounded-2xl border bg-card p-4 shadow-sm" />
          <StatTile layout="label-top" label="Upcoming Events" sub="Next 60 days" value={data.upcomingEvents.length} href="/events" className="rounded-2xl border bg-card p-4 shadow-sm" />
        </StatTileGrid>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick Actions</p>
            <p className="mt-1 text-sm text-muted-foreground">Common things, one click away.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/leads/new" icon={UserPlus} label="Add a new lead" />
          <QuickAction href="/clients/new" icon={PartyPopper} label="Create a booking" />
          <QuickAction href="/contracts/new" icon={FilePlus2} label="Create a contract" />
          <QuickAction href="/invoices/new" icon={Receipt} label="Create an invoice" />
          <QuickAction href="/messaging" icon={MessageSquare} label="Send a message" />
          <QuickAction href="/tasks" icon={ClipboardCheck} label="Add a task" />
          <QuickAction href="/calendar" icon={CalendarClock} label="Open calendar" />
          <QuickAction href="/reporting" icon={Sparkles} label="Explore reporting" />
        </div>
      </section>

      {data.onboarding.show && <CompactGettingStarted data={data} />}

      <Link href="/reporting" className="group flex items-center justify-between rounded-2xl border bg-card px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div>
          <p className="font-heading text-lg font-semibold text-heading">Want the bigger picture?</p>
          <p className="text-sm text-muted-foreground">Dive into revenue, bookings, leads, and venue performance.</p>
        </div>
        <ArrowRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

function SummaryCard({ icon: Icon, eyebrow, title, value, detail, foot, href, tone }: { icon: React.ElementType; eyebrow: string; title: string; value: string | number; detail: string; foot: string; href: string; tone: "sage" | "blush" | "cream" | "green" }) {
  const toneClass = {
    sage: "bg-gradient-to-br from-primary/10 via-card to-card",
    blush: "bg-gradient-to-br from-rose-50/90 via-card to-card",
    cream: "bg-gradient-to-br from-amber-50/90 via-card to-card",
    green: "bg-gradient-to-br from-emerald-50/90 via-card to-card",
  }[tone];
  return (
    <Link href={href} className={`group rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 text-primary shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-5 font-heading text-3xl font-semibold tracking-tight text-heading">{value}</p>
      <p className="mt-1 truncate text-sm text-foreground/80">{detail}</p>
      <p className="mt-4 text-xs font-medium text-muted-foreground group-hover:text-primary">{foot} →</p>
    </Link>
  );
}

function LuvCard({ observation, recommendation, href, label }: { observation: string | null; recommendation: string | null; href: string; label: string }) {
  return (
    <Card className="overflow-hidden border-rose-200/60 bg-gradient-to-br from-rose-50/80 via-card to-card shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-heading text-xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-rose-400 shadow-sm"><Heart className="h-4 w-4 fill-current" /></span>
          Luv&apos;s Nudge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {observation ? <p className="text-sm leading-6 text-foreground">{observation}</p> : <p className="text-sm leading-6 text-muted-foreground">A little help, whenever you need it.</p>}
        {recommendation && <p className="text-sm text-muted-foreground">{recommendation}</p>}
        <Button render={<Link href={href} />} size="sm" className="rounded-full">{label}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
      </CardContent>
    </Card>
  );
}

function CompactGettingStarted({ data }: { data: DashboardData }) {
  const pct = data.onboarding.totalSteps ? Math.round((data.onboarding.completedCount / data.onboarding.totalSteps) * 100) : 0;
  const visibleSteps = data.onboarding.steps.slice(0, 5);
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Getting Started</p>
          <h2 className="mt-1 font-heading text-xl font-semibold text-heading">Make the most of Hello to Cheers</h2>
          <p className="mt-1 text-sm text-muted-foreground">A few helpful next steps — not a test you have to pass.</p>
        </div>
        <span className="text-sm font-medium text-muted-foreground">{data.onboarding.completedCount} of {data.onboarding.totalSteps} complete</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/70" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {visibleSteps.map((step) => (
          <Link key={step.id} href={step.ctaHref ?? "#"} className="rounded-xl border bg-background/70 p-3 transition hover:border-primary/30 hover:bg-primary/5">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${step.completed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step.completed ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-semibold">•</span>}
            </span>
            <p className={`mt-3 text-sm leading-snug ${step.completed ? "text-muted-foreground line-through" : "font-medium text-foreground"}`}>{step.title}</p>
            {!step.completed && step.ctaLabel && <p className="mt-2 text-xs font-medium text-primary">{step.ctaLabel} →</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between rounded-xl border bg-background/60 px-4 py-3 text-sm font-medium transition hover:border-primary/30 hover:bg-primary/5">
      <span className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}

function ClassifiedRow({ item }: { item: ClassifiedItem }) {
  const severity = item.rightSeverity ?? PRIORITY_SEVERITY[item.priority];
  const colorClass = severity === "critical" ? "text-destructive" : severity === "warning" ? "text-warning-foreground" : "text-muted-foreground";
  return (
    <Link href={item.href} className="flex items-start justify-between gap-4 rounded-lg px-2 py-3 transition hover:bg-muted/40">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
        {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
      </div>
      {item.rightLabel && <span className={`shrink-0 pt-0.5 text-xs font-medium ${colorClass}`}>{item.rightLabel}</span>}
    </Link>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="py-7 text-center text-sm text-muted-foreground">{text}</p>;
}

function timeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes || 0).padStart(2, "0")} ${suffix}`;
}

function formatCurrencyShort(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

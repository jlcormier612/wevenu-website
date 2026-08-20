"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CalendarDays, MessageSquare, CheckSquare, Circle, Clock } from "lucide-react";

import { completeVendorTaskAction } from "@/app/vendor/(workspace)/tasks/actions";
import { formatTime } from "@/lib/vendors/constants";
import type { VendorHomeData } from "@/lib/vendor-home/service";
import type { LuvBriefing } from "@/lib/luv/briefing-types";
import { VendorVenueHero } from "@/components/vendor-app/vendor-venue-hero";
import { VendorLuvBriefing } from "@/components/vendor-app/vendor-luv-briefing";
import { VendorLuvIntro } from "@/components/vendor-app/vendor-luv-intro";
import { vendorCounterpartyDisplayName } from "@/lib/conversations/vendor-counterparty";
import type { VendorActiveVenueContext, VendorPartnership } from "@/lib/vendors/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Card({ icon: Icon, title, href, count, children }: {
  icon: React.ElementType; title: string; href: string; count: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
          {count > 0 && <span className="text-xs font-normal text-muted-foreground">({count})</span>}
        </h2>
        <Link href={href} className="text-xs text-primary hover:underline">View all →</Link>
      </div>
      {children}
    </div>
  );
}

/**
 * Vendor Workspace Realignment, Phase 4 (2026-07-22) — Home rebuilt around
 * exactly the questions a vendor asks each morning: what events need me
 * today, what messages need a reply, what tasks are due, what's next on my
 * schedule. Replaces the old CRM-style dashboard (stat tiles, business
 * health score, Luv coaching) entirely — see
 * docs/vendor-workspace-realignment-audit.md.
 *
 * Venue-First Dashboard (2026-07-24) — "The vendor should always feel like
 * they are working with a venue, not browsing a marketplace." The venue
 * hero/contacts/promotion block (VendorVenueHero) now leads, above the
 * daily-attention cards below — same design language as the Couple
 * Workspace's own venue-first hero. Everything below is unchanged in
 * substance, just reordered per the directive's own list: Upcoming Events,
 * Outstanding Tasks, Messages, then Coming Up ("Recent Activity").
 */
export function VendorHome({ greetingName, data, briefing, showLuvIntro, activeVenue, partnerships, vendorCategory }: {
  greetingName: string;
  data: VendorHomeData;
  briefing: LuvBriefing;
  showLuvIntro: boolean;
  activeVenue: VendorActiveVenueContext;
  partnerships: VendorPartnership[];
  vendorCategory: string | null;
}) {
  const [pending, startTransition] = useTransition();

  // Only show the empty state when nothing on Home needs attention —
  // including Coming Up, not just today's action queue.
  const nothingNeedsAttention =
    data.eventsToday.length === 0 &&
    data.unreadConversations.length === 0 &&
    data.tasksDue.length === 0 &&
    data.nextTimeline.length === 0;

  function handleCompleteTask(taskId: string) {
    startTransition(async () => {
      await completeVendorTaskAction(taskId);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-medium tracking-tight text-heading">{greetingWord()}, {greetingName}.</h1>
        <p className="text-[0.95rem] text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <VendorLuvIntro show={showLuvIntro} />

      <VendorVenueHero initialVenue={activeVenue} partnerships={partnerships} vendorCategory={vendorCategory} allEvents={data.allEvents} />

      {/* Same Luv Daily Briefing job as venue Today — compact on Home */}
      <VendorLuvBriefing briefing={briefing} compact />

      {nothingNeedsAttention && (
        <div className="rounded-sm border border-dashed border-border py-8 text-center">
          <p className="text-sm font-medium text-foreground">Nothing needs your attention today</p>
          <p className="text-xs text-muted-foreground mt-1">You&apos;re all caught up.</p>
        </div>
      )}

      {/* What events require me today */}
      {data.eventsToday.length > 0 && (
        <Card icon={CalendarDays} title="Today" href="/vendor/events" count={data.eventsToday.length}>
          <div className="divide-y divide-border">
            {data.eventsToday.map((ev) => (
              <Link key={ev.assignmentId} href={`/vendor/events/${ev.assignmentId}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ev.eventName}</p>
                  <p className="text-xs text-muted-foreground">{ev.venueName}</p>
                </div>
                {ev.arrivalTime && <p className="text-xs text-muted-foreground shrink-0">Arrival {formatTime(ev.arrivalTime)}</p>}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* What tasks are due — completable inline, or open the event Tasks tab */}
      {data.tasksDue.length > 0 && (
        <Card
          icon={CheckSquare}
          title="Outstanding tasks"
          href="/vendor/events"
          count={data.tasksDue.length}
        >
          <div className="divide-y divide-border">
            {data.tasksDue.slice(0, 5).map((t) => {
              const ev = t.eventId
                ? data.allEvents.find((e) => e.eventId === t.eventId)
                : undefined;
              const href = ev
                ? `/vendor/events/${ev.assignmentId}?tab=tasks&focus=${encodeURIComponent(t.id)}`
                : "/vendor/events";
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleCompleteTask(t.id)}
                    disabled={pending}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    aria-label={`Mark "${t.title}" complete`}
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                  <Link
                    href={href}
                    className="min-w-0 flex-1 flex items-center justify-between gap-4 hover:opacity-80 transition-opacity"
                  >
                    <p className="text-sm text-foreground truncate">{t.title}</p>
                    {t.dueDate && <p className="text-xs text-muted-foreground shrink-0">{formatDate(t.dueDate)}</p>}
                  </Link>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* What messages need a reply */}
      {data.unreadConversations.length > 0 && (
        <Card icon={MessageSquare} title="Messages needing a reply" href="/vendor/messages" count={data.unreadConversations.length}>
          <div className="divide-y divide-border">
            {data.unreadConversations.slice(0, 5).map((c) => (
              <Link key={c.conversationId} href={`/vendor/messages/${c.conversationId}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {c.eventName}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {vendorCounterpartyDisplayName(c.counterpartyLabel, c.venueName, c.coupleName)}
                    </span>
                  </p>
                  {c.latestMessage && <p className="text-xs text-muted-foreground truncate">{c.latestMessage.body}</p>}
                </div>
                <span className="h-5 min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                  {c.contactUnread}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* What's next on my schedule — deep-link to the event Timeline when known */}
      {data.nextTimeline.length > 0 && (
        <Card
          icon={Clock}
          title="Coming up"
          href={
            data.nextTimeline.length === 1
              ? `/vendor/events/${data.nextTimeline[0].assignmentId}?tab=timeline`
              : "/vendor/events"
          }
          count={data.nextTimeline.length}
        >
          <div className="divide-y divide-border">
            {data.nextTimeline.map((ev) => (
              <div key={ev.assignmentId} className="px-4 py-3">
                <Link href={`/vendor/events/${ev.assignmentId}?tab=timeline`} className="text-sm font-medium text-foreground hover:text-primary">{ev.eventName}</Link>
                <div className="mt-1 space-y-1">
                  {ev.entries.slice(0, 3).map((entry) => (
                    <p key={entry.id} className="text-xs text-muted-foreground">
                      {entry.time ? formatTime(entry.time) : "—"} · {entry.title}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

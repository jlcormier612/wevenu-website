"use client";

import Link from "next/link";
import { CalendarDays, MessageSquare, CheckSquare, Clock, FileText } from "lucide-react";

import { formatTime } from "@/lib/vendors/constants";
import type { VendorHomeData } from "@/lib/vendor-home/service";
import { VendorVenueHero } from "@/components/vendor-app/vendor-venue-hero";
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
    <div className="rounded-xl border border-border bg-card overflow-hidden">
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
 * schedule, what documents need attention. Replaces the old CRM-style
 * dashboard (stat tiles, business health score, Luv coaching) entirely —
 * see docs/vendor-workspace-realignment-audit.md.
 *
 * Venue-First Dashboard (2026-07-24) — "The vendor should always feel like
 * they are working with a venue, not browsing a marketplace." The venue
 * hero/contacts/promotion block (VendorVenueHero) now leads, above the
 * daily-attention cards below — same design language as the Couple
 * Workspace's own venue-first hero. Everything below is unchanged in
 * substance, just reordered per the directive's own list: Upcoming Events,
 * Outstanding Tasks, Messages, then Coming Up/Documents ("Recent Activity").
 */
export function VendorHome({ greetingName, data, activeVenue, partnerships, vendorCategory }: {
  greetingName: string;
  data: VendorHomeData;
  activeVenue: VendorActiveVenueContext;
  partnerships: VendorPartnership[];
  vendorCategory: string | null;
}) {
  const nothingToday = data.eventsToday.length === 0 && data.unreadConversations.length === 0 && data.tasksDue.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greetingWord()}, {greetingName}.</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <VendorVenueHero initialVenue={activeVenue} partnerships={partnerships} vendorCategory={vendorCategory} allEvents={data.allEvents} />

      {nothingToday && (
        <div className="rounded-xl border border-dashed border-border py-8 text-center">
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

      {/* What tasks are due */}
      {data.tasksDue.length > 0 && (
        <Card icon={CheckSquare} title="Outstanding Tasks" href="/vendor/tasks" count={data.tasksDue.length}>
          <div className="divide-y divide-border">
            {data.tasksDue.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <p className="text-sm text-foreground truncate">{t.title}</p>
                {t.dueDate && <p className="text-xs text-muted-foreground shrink-0">{formatDate(t.dueDate)}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* What messages need a reply */}
      {data.unreadConversations.length > 0 && (
        <Card icon={MessageSquare} title="Messages Needing a Reply" href="/vendor/messages" count={data.unreadConversations.length}>
          <div className="divide-y divide-border">
            {data.unreadConversations.slice(0, 5).map((c) => (
              <Link key={c.conversationId} href={`/vendor/messages/${c.conversationId}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.eventName}</p>
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

      {/* What's next on my schedule */}
      {data.nextTimeline.length > 0 && (
        <Card icon={Clock} title="Coming Up" href="/vendor/timeline" count={data.nextTimeline.length}>
          <div className="divide-y divide-border">
            {data.nextTimeline.map((ev) => (
              <div key={ev.assignmentId} className="px-4 py-3">
                <Link href={`/vendor/events/${ev.assignmentId}`} className="text-sm font-medium text-foreground hover:text-primary">{ev.eventName}</Link>
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

      {/* What documents need attention */}
      {data.recentDocuments.length > 0 && (
        <Card icon={FileText} title="Documents" href="/vendor/documents" count={data.recentDocuments.length}>
          <div className="divide-y divide-border">
            {data.recentDocuments.map((ev) => (
              <div key={ev.assignmentId} className="px-4 py-3">
                <Link href={`/vendor/events/${ev.assignmentId}`} className="text-sm font-medium text-foreground hover:text-primary">{ev.eventName}</Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ev.documents.length + ev.floorPlans.length} item{ev.documents.length + ev.floorPlans.length === 1 ? "" : "s"} shared
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

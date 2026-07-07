"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, CheckSquare, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { VendorLuvBriefing } from "@/components/vendor-app/vendor-luv-briefing";
import { VendorHealthScoreWidget } from "@/components/vendor-app/vendor-health-score-widget";
import { formatTime } from "@/lib/vendors/constants";
import type { VendorDashboardData, VendorDashboardEvent } from "@/lib/vendors/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function computeLuvData(data: VendorDashboardData) {
  const wins: string[] = [];
  const observations: string[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const recentVenues = data.venues.filter((v) => v.addedAt >= sevenDaysAgo);
  if (recentVenues.length > 0) {
    wins.push(`Connected with ${recentVenues.length} new ${recentVenues.length === 1 ? "venue" : "venues"} this week`);
  }
  if (data.upcomingEvents.length > 0) {
    wins.push(`${data.upcomingEvents.length} upcoming ${data.upcomingEvents.length === 1 ? "event" : "events"} confirmed`);
  }

  if (data.newInquiryCount > 0) {
    observations.push(`${data.newInquiryCount} new ${data.newInquiryCount === 1 ? "inquiry" : "inquiries"} waiting for a response`);
  }
  if (data.pendingTaskCount > 0) {
    observations.push(`${data.pendingTaskCount} ${data.pendingTaskCount === 1 ? "task is" : "tasks are"} due soon`);
  }

  const profile = data.vendor;
  if (profile.insuranceExpiry) {
    const daysLeft = Math.ceil(
      (new Date(profile.insuranceExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysLeft > 0 && daysLeft <= 30) {
      observations.push(`Insurance expires in ${daysLeft} days — renew soon`);
    }
  }

  const profileFields = [
    profile.businessName, profile.category, profile.description,
    profile.contactName, profile.email, profile.phone,
    profile.pricingTier, profile.serviceArea,
  ];
  const filledCount = profileFields.filter(Boolean).length;
  if (filledCount < 6) {
    observations.push("Profile is incomplete — finish it to improve your business health score");
  }

  return { wins, observations };
}

const STATUS_LABELS: Record<string, string> = {
  active:    "Active",
  preferred: "Preferred",
  invited:   "Invited",
};

function EventRow({ ev }: { ev: VendorDashboardEvent }) {
  return (
    <Link
      href={`/vendor/events`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{ev.eventName}</p>
        <p className="text-xs text-muted-foreground">{ev.venueName}</p>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        {ev.eventDate && (
          <p className="text-xs font-medium text-foreground">{formatDate(ev.eventDate)}</p>
        )}
        {ev.arrivalTime && (
          <p className="text-xs text-muted-foreground">Arrival {formatTime(ev.arrivalTime)}</p>
        )}
      </div>
    </Link>
  );
}

export function VendorDashboard({ data }: { data: VendorDashboardData }) {
  const today = todayIso();
  const todayEvents = data.upcomingEvents.filter((e) => e.eventDate === today);
  const futureEvents = data.upcomingEvents.filter((e) => !e.eventDate || e.eventDate > today);
  const { wins, observations } = computeLuvData(data);

  return (
    <div className="space-y-6">
      {/* Morning briefing header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {greetingWord()}, {data.vendor.businessName}.
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Luv briefing */}
      <VendorLuvBriefing
        wins={wins}
        observations={observations}
        healthTip={data.healthScore?.luvTip}
      />

      {/* Action counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "New Inquiries",    value: data.newInquiryCount,          href: "/vendor/inquiries", icon: Inbox },
          { label: "Tasks Due Soon",   value: data.pendingTaskCount,         href: "/vendor/tasks",     icon: CheckSquare },
          { label: "Upcoming Events",  value: data.upcomingEvents.length,    href: "/vendor/events",    icon: CalendarDays },
          { label: "Connected Venues", value: data.venues.length,            href: "/vendor/venues",    icon: null },
        ].map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href}>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1 hover:border-primary/30 transition-colors cursor-pointer">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {Icon && <Icon className="h-3 w-3 shrink-0" />}
                {label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Today's schedule */}
      {todayEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-foreground">Today</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {todayEvents.map((ev) => <EventRow key={ev.id} ev={ev} />)}
          </div>
        </div>
      )}

      {/* Upcoming events */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Upcoming Events</h2>
          <Link href="/vendor/events" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        {futureEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No upcoming events</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Venues will assign you to events when they book you.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {futureEvents.slice(0, 5).map((ev) => <EventRow key={ev.id} ev={ev} />)}
          </div>
        )}
      </div>

      {/* Business Health Score */}
      {data.healthScore && (
        <div className="space-y-3">
          <h2 className="font-semibold text-foreground">Business Health</h2>
          <VendorHealthScoreWidget health={data.healthScore} />
        </div>
      )}

      {/* Connected venues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Connected Venues</h2>
          <Link href="/vendor/venues" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        {data.venues.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center rounded-xl border border-dashed border-border">
            No venues yet. Venues will appear here once they add you to their directory.
          </p>
        ) : (
          <div className="space-y-2">
            {data.venues.slice(0, 3).map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {v.venueName.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{v.venueName}</p>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {STATUS_LABELS[v.status] ?? v.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

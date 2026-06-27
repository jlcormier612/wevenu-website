"use client";

import * as React from "react";

import Link from "next/link";
import { Search } from "lucide-react";

import { EventStatusBadge } from "@/components/events/event-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EVENT_STATUSES, daysUntil, eventStatusLabel, formatDate, formatTime } from "@/lib/events/constants";
import type { EventStatus, VenueEvent } from "@/lib/events/types";
import { eventTypeLabel } from "@/lib/leads/constants";
import { cn } from "@/lib/utils";

type FilterKey = "all" | EventStatus;
type SortKey = "event_asc" | "event_desc" | "az" | "za" | "newest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "event_asc",  label: "Event Date (Soonest)" },
  { value: "event_desc", label: "Event Date (Latest)" },
  { value: "az",         label: "A → Z" },
  { value: "za",         label: "Z → A" },
  { value: "newest",     label: "Recently Added" },
];

export function EventList({ events }: { events: VenueEvent[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [sort, setSort] = React.useState<SortKey>("event_asc");

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    const base = events.filter((e) => {
      if (filter !== "all" && e.status !== filter) return false;
      if (!q) return true;
      return [e.name, e.eventType].some((v) => v?.toLowerCase().includes(q));
    });
    return [...base].sort((a, b) => {
      switch (sort) {
        case "event_desc": return (b.eventDate ?? "") < (a.eventDate ?? "") ? -1 : 1;
        case "az":         return a.name.localeCompare(b.name);
        case "za":         return b.name.localeCompare(a.name);
        case "newest":     return (b.createdAt ?? "") < (a.createdAt ?? "") ? -1 : 1;
        default:           return (a.eventDate ?? "9999") < (b.eventDate ?? "9999") ? -1 : 1;
      }
    });
  }, [events, query, filter, sort]);

  const counts = React.useMemo(() => {
    const m = new Map<FilterKey, number>([["all", events.length]]);
    EVENT_STATUSES.forEach((s) => m.set(s.value, 0));
    events.forEach((e) => m.set(e.status, (m.get(e.status) ?? 0) + 1));
    return m;
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…" className="pl-9" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-full sm:w-52 text-sm text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", ...EVENT_STATUSES.map((s) => s.value)] as FilterKey[]).map((key) => {
          const label = key === "all" ? "All" : eventStatusLabel(key);
          const count = counts.get(key) ?? 0;
          const active = filter === key;
          return (
            <button key={key} type="button" onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
              {label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No events yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create an event to build the workspace for a booked date.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href="/clients" />} variant="outline">View Clients</Button>
            <Button render={<Link href="/events/new" />}>+ New Event</Button>
          </div>
        </div>
      )}

      {events.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No events match your filters.</p>
          <Button variant="link" size="sm" className="mt-1" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Countdown</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ev) => {
                const days = ev.eventDate ? daysUntil(ev.eventDate) : null;
                const past = days != null && days < 0;
                const soon = !past && days != null && days <= 14;
                return (
                  <TableRow key={ev.id} className="group">
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/events/${ev.id}`} className="hover:text-primary">{ev.name}</Link>
                      {ev.eventType && <p className="text-xs text-muted-foreground">{eventTypeLabel(ev.eventType)}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{ev.eventDate ? formatDate(ev.eventDate) : <span className="text-muted-foreground">TBD</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ev.startTime ? formatTime(ev.startTime) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ev.guestCount != null ? ev.guestCount.toLocaleString() : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><EventStatusBadge status={ev.status} /></TableCell>
                    <TableCell>
                      {days != null ? (
                        <span className={cn("text-xs font-medium", past ? "text-muted-foreground" : soon ? "text-destructive" : "text-muted-foreground")}>
                          {days === 0 ? "Today" : days > 0 ? `${days}d` : `${Math.abs(days)}d ago`}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" render={<Link href={`/events/${ev.id}`} />}>View →</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

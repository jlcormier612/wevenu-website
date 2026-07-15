"use client";

import * as React from "react";

import Link from "next/link";
import { Search } from "lucide-react";

import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  clientDisplayName,
  eventTypeLabel,
  formatDate,
} from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";

// Client Workspace list-page UX pass — the chips used to be the record's
// raw lifecycle status (Planning/Confirmed/Complete/Cancelled), which
// answers "what stage is this record in," not "what do I need to look at
// this morning." These are operational views instead, computed from data
// already on the Client object (plus one attention-flag set fetched once
// for the whole page — see lib/clients/service.ts's getClientAttentionFlags)
// — no new backend state, no new columns.
type FilterKey = "all" | "upcoming" | "wedding_week" | "needs_attention" | "past" | "cancelled";
type SortKey = "event_asc" | "event_desc" | "az" | "za" | "newest";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "wedding_week", label: "Wedding Week" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "event_asc",  label: "Event Date (Soonest)" },
  { value: "event_desc", label: "Event Date (Latest)" },
  { value: "az",         label: "A → Z" },
  { value: "za",         label: "Z → A" },
  { value: "newest",     label: "Most Recent" },
];

// Sticky filter — same shape as components/calendar/use-calendar-filters.ts:
// a browser preference, not a synced one. First-ever visit (no saved key
// yet) defaults to "upcoming" — that's what almost everyone wants first —
// after that, whatever the coordinator last picked, including "all" for an
// owner who prefers the full list.
const FILTER_STORAGE_KEY = "wevenu-clients-filter";

function loadSavedFilter(): FilterKey | null {
  if (typeof window === "undefined") return null;
  try {
    return (window.localStorage.getItem(FILTER_STORAGE_KEY) as FilterKey) || null;
  } catch {
    return null;
  }
}

export function ClientList({ clients, attentionClientIds = new Set(), today }: { clients: Client[]; attentionClientIds?: Set<string>; today: string }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilterState] = React.useState<FilterKey>(() => loadSavedFilter() ?? "upcoming");
  const [sort, setSort] = React.useState<SortKey>("event_asc");

  const setFilter = React.useCallback((next: FilterKey) => {
    setFilterState(next);
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(FILTER_STORAGE_KEY, next); } catch { /* ignore */ }
    }
  }, []);

  // Computed once server-side and passed down — see app/(app)/clients/page.tsx.
  const weekOut = React.useMemo(() => new Date(new Date(today + "T00:00:00Z").getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), [today]);

  const matchesFilter = React.useCallback((c: Client, key: FilterKey): boolean => {
    switch (key) {
      case "all":             return c.status !== "cancelled";
      case "upcoming":        return c.status !== "cancelled" && !!c.eventDate && c.eventDate >= today;
      case "wedding_week":    return c.status !== "cancelled" && !!c.eventDate && c.eventDate >= today && c.eventDate <= weekOut;
      case "needs_attention": return c.status !== "cancelled" && attentionClientIds.has(c.id);
      case "past":            return c.status !== "cancelled" && !!c.eventDate && c.eventDate < today;
      case "cancelled":       return c.status === "cancelled";
    }
  }, [today, weekOut, attentionClientIds]);

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const base = clients.filter((c) => {
      if (!matchesFilter(c, filter)) return false;
      if (!q) return true;
      return [c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName, c.email, c.eventType]
        .some((v) => v?.toLowerCase().includes(q));
    });
    return [...base].sort((a, b) => {
      switch (sort) {
        case "event_desc": return (b.eventDate ?? "") < (a.eventDate ?? "") ? -1 : 1;
        case "az":         return (a.firstName ?? "").localeCompare(b.firstName ?? "");
        case "za":         return (b.firstName ?? "").localeCompare(a.firstName ?? "");
        case "newest":     return (b.createdAt ?? "") < (a.createdAt ?? "") ? -1 : 1;
        default:           return (a.eventDate ?? "9999") < (b.eventDate ?? "9999") ? -1 : 1;
      }
    });
  }, [clients, query, filter, sort, matchesFilter]);

  const counts = React.useMemo(() => {
    const m = new Map<FilterKey, number>();
    FILTERS.forEach(({ key }) => m.set(key, clients.filter((c) => matchesFilter(c, key)).length));
    return m;
  }, [clients, matchesFilter]);

  // "What kind of day am I walking into?" is now answered by the filter
  // pills themselves — they already carry counts and already act as the
  // click target, so a separate metric strip above them was showing the
  // same three numbers twice under two different labels ("Active Weddings"
  // vs. "All," "This Week" vs. "Wedding Week"). The one fact the pills
  // don't already say out loud — a wedding is happening today — gets a
  // single non-clickable line instead, only when it's actually true.
  const weddingDayToday = React.useMemo(
    () => clients.filter((c) => c.status !== "cancelled" && c.eventDate === today).length,
    [clients, today],
  );

  return (
    <div className="space-y-4">
      {weddingDayToday > 0 && (
        <p className="text-sm font-medium text-heading">
          🎉 {weddingDayToday} wedding{weddingDayToday === 1 ? "" : "s"} today
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by couple or event type…" className="pl-9" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)} items={SORT_OPTIONS}>
          <SelectTrigger className="h-9 w-full sm:w-52 text-sm text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {/* Operational view pills — what to look at, not what stage a record is in */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => {
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

      {clients.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No clients yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            When you book a client, convert their lead inquiry here — or add a client directly.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href="/leads" />} variant="outline">View Leads</Button>
            <Button render={<Link href="/clients/new" />}>+ New Client</Button>
          </div>
        </div>
      )}

      {clients.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No clients match your filters.</p>
          <Button variant="link" size="sm" className="mt-1" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id} className="group">
                  <TableCell className="font-medium text-foreground">
                    <Link href={`/clients/${client.id}`} className="hover:text-primary">
                      {clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName)}
                    </Link>
                    {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
                  </TableCell>
                  <TableCell>
                    {client.eventType
                      ? <Badge variant="outline">{eventTypeLabel(client.eventType)}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {client.eventDate ? formatDate(client.eventDate) : <span className="text-muted-foreground">TBD</span>}
                  </TableCell>
                  <TableCell><ClientStatusBadge status={client.status} /></TableCell>
                  <TableCell className="text-sm">
                    {client.guestCount != null ? client.guestCount.toLocaleString() : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" render={<Link href={`/clients/${client.id}`} />}>View →</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import {
  CLIENT_LIST_FILTERS,
  clientMatchesListFilter,
  countClientListFilters,
  parseClientListFilter,
  comingUpHorizonEnd,
  type ClientListFilterKey,
} from "@/lib/clients/list-filters";
import type { Client } from "@/lib/clients/types";
import {
  IDLE_CHIP,
  IDLE_CHIP_COUNT,
  SELECTED_CHIP,
  SELECTED_CHIP_COUNT,
} from "@/lib/ui/selected-state";
import { cn } from "@/lib/utils";

// Operational buckets: All Bookings is the working list. Coming up and
// Needs Attention are subsets of it. Cancelled and Past are historical.
type SortKey = "event_asc" | "event_desc" | "az" | "za" | "newest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "event_asc",  label: "Event Date (Soonest)" },
  { value: "event_desc", label: "Event Date (Latest)" },
  { value: "az",         label: "A → Z" },
  { value: "za",         label: "Z → A" },
  { value: "newest",     label: "Most Recent" },
];

// Sticky filter — a browser preference, not a synced one. First visit
// opens All Bookings, the active working list.
const FILTER_STORAGE_KEY = "wevenu-clients-filter";

function loadSavedFilter(): ClientListFilterKey | null {
  if (typeof window === "undefined") return null;
  try {
    return parseClientListFilter(window.localStorage.getItem(FILTER_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistFilter(next: ClientListFilterKey) {
  try { window.localStorage.setItem(FILTER_STORAGE_KEY, next); } catch { /* ignore */ }
}

export function ClientList({
  clients,
  attentionClientIds = new Set(),
  bookedClientIds = new Set(),
  today,
}: {
  clients: Client[];
  attentionClientIds?: Set<string>;
  /** Clients with events.booked_at set and the event not cancelled. */
  bookedClientIds?: Set<string>;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlFilter = parseClientListFilter(searchParams.get("filter"));
  const [query, setQuery] = React.useState("");
  const [storedFilter, setStoredFilter] = React.useState<ClientListFilterKey>(() => loadSavedFilter() ?? "all");
  const [sort, setSort] = React.useState<SortKey>("event_asc");
  const filter = urlFilter ?? storedFilter;

  // URL is the source of truth while present (Dashboard deep-link). Persist
  // it for the next visit without copying it into React state — filter is
  // already `urlFilter ?? storedFilter`.
  React.useEffect(() => {
    if (!urlFilter) return;
    persistFilter(urlFilter);
  }, [urlFilter]);

  const setFilter = React.useCallback((next: ClientListFilterKey) => {
    setStoredFilter(next);
    persistFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  // Venue-local today, passed from the server — same string the Dashboard count uses.
  const comingUpOut = React.useMemo(() => comingUpHorizonEnd(today), [today]);
  const filterCtx = React.useMemo(
    () => ({ today, comingUpOut, attentionClientIds, bookedClientIds }),
    [today, comingUpOut, attentionClientIds, bookedClientIds],
  );

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const base = clients.filter((c) => {
      if (!clientMatchesListFilter(c, filter, filterCtx)) return false;
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
  }, [clients, query, filter, sort, filterCtx]);

  const counts = React.useMemo(() => countClientListFilters(clients, filterCtx), [clients, filterCtx]);

  // A wedding happening today is the one fact the pills don't already say.
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
            placeholder="Search by client or event type…" className="pl-9" />
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
        {CLIENT_LIST_FILTERS.map(({ key, label }) => {
          const count = counts[key];
          const active = filter === key;
          return (
            <button key={key} type="button" onClick={() => setFilter(key)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? SELECTED_CHIP : IDLE_CHIP,
              )}>
              {label}
              <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", active ? SELECTED_CHIP_COUNT : IDLE_CHIP_COUNT)}>{count}</span>
            </button>
          );
        })}
      </div>

      {clients.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
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
        <div className="rounded-sm border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No clients match your filters.</p>
          <Button variant="link" size="sm" className="mt-1" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-sm border border-border bg-card">
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

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
  CLIENT_STATUSES,
  clientDisplayName,
  eventTypeLabel,
  formatDate,
} from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";

type FilterKey = "all" | Client["status"];
type SortKey = "event_asc" | "event_desc" | "az" | "za" | "newest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "event_asc",  label: "Event Date (Soonest)" },
  { value: "event_desc", label: "Event Date (Latest)" },
  { value: "az",         label: "A → Z" },
  { value: "za",         label: "Z → A" },
  { value: "newest",     label: "Most Recent" },
];

export function ClientList({ clients }: { clients: Client[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [sort, setSort] = React.useState<SortKey>("event_asc");

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const base = clients.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
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
  }, [clients, query, filter, sort]);

  const counts = React.useMemo(() => {
    const m = new Map<FilterKey, number>([["all", clients.length]]);
    CLIENT_STATUSES.forEach((s) => m.set(s.value, 0));
    clients.forEach((c) => m.set(c.status, (m.get(c.status) ?? 0) + 1));
    return m;
  }, [clients]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or event type…" className="pl-9" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-full sm:w-52 text-sm text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...CLIENT_STATUSES.map((s) => s.value)] as FilterKey[]).map((key) => {
          const label = key === "all" ? "All" : CLIENT_STATUSES.find((s) => s.value === key)?.label ?? key;
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
            When you book a couple, convert their lead inquiry here — or add a client directly.
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
                <TableHead>Couple</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell className="text-sm">
                    {client.guestCount != null ? client.guestCount.toLocaleString() : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><ClientStatusBadge status={client.status} /></TableCell>
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

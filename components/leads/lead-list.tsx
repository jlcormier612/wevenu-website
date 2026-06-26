"use client";

import * as React from "react";

import Link from "next/link";
import { Search } from "lucide-react";

import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LEAD_STATUSES,
  eventTypeLabel,
  formatDate,
  formatCurrency,
  leadDisplayName,
} from "@/lib/leads/constants";
import type { Lead, LeadStatus } from "@/lib/leads/types";

type FilterKey = "all" | LeadStatus;

export function LeadList({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return [
        l.firstName, l.lastName, l.partnerFirstName, l.partnerLastName,
        l.email, l.phone, l.eventType, l.source,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [leads, query, filter]);

  // Count per status for filter tabs.
  const counts = React.useMemo(() => {
    const map = new Map<FilterKey, number>([["all", leads.length]]);
    LEAD_STATUSES.forEach((s) => map.set(s.value, 0));
    leads.forEach((l) => map.set(l.status, (map.get(l.status) ?? 0) + 1));
    return map;
  }, [leads]);

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, event type…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...LEAD_STATUSES.map((s) => s.value)] as FilterKey[]).map((key) => {
          const label = key === "all" ? "All" : LEAD_STATUSES.find((s) => s.value === key)?.label ?? key;
          const count = counts.get(key) ?? 0;
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {leads.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No inquiries yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            When a couple or client reaches out, add their inquiry here to start tracking it.
          </p>
          <Button render={<Link href="/leads/new" />}>
            + New Inquiry
          </Button>
        </div>
      )}

      {leads.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No leads match your filters.</p>
          <Button variant="link" size="sm" className="mt-1" onClick={() => { setQuery(""); setFilter("all"); }}>
            Clear filters
          </Button>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id} className="group">
                  <TableCell className="font-medium text-foreground">
                    <Link href={`/leads/${lead.id}`} className="hover:text-primary">
                      {leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}
                    </Link>
                    {lead.email && (
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.eventType ? (
                      <Badge variant="outline">{eventTypeLabel(lead.eventType)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.eventDate ? formatDate(lead.eventDate) : <span className="text-muted-foreground">TBD</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.guestCount != null ? lead.guestCount.toLocaleString() : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.estimatedBudget != null ? formatCurrency(lead.estimatedBudget) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(lead.inquiryDate)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" render={<Link href={`/leads/${lead.id}`} />}>
                      View →
                    </Button>
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

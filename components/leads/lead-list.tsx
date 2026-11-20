"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";

function momentumLabel(score: number, status: string): { tier: "hot" | "warm" | "growing" | "early" | "quiet" } {
  if (status === "booked" || status === "won") return { tier: "hot" };
  if (status === "lost" || status === "cancelled") return { tier: "quiet" };
  if (score >= 70) return { tier: "hot" };
  if (score >= 45) return { tier: "warm" };
  if (score >= 20) return { tier: "growing" };
  return { tier: "early" };
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  ACTIVE_STATUSES,
  eventTypeLabel,
  formatDate,
  formatCurrency,
  leadDisplayName,
  sourceLabel,
} from "@/lib/leads/constants";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import { salesStageLabel } from "@/lib/leads/sales-stages";
import { LeadUnseenIndicator } from "@/components/leads/lead-unseen-indicator";
import { LeadMessageAttentionIndicator } from "@/components/leads/lead-message-attention-indicator";
import type { LeadMessageAttention } from "@/lib/leads/message-attention";
import type { LeadsListSort } from "@/lib/leads/list-query";
import { UNATTENDED_INQUIRY_ATTENTION } from "@/lib/luv/unattended-inquiry";
import {
  ATTENTION_CHIP,
  ATTENTION_CHIP_COUNT,
  IDLE_CHIP,
  IDLE_CHIP_COUNT,
  SELECTED_CHIP,
  SELECTED_CHIP_COUNT,
} from "@/lib/ui/selected-state";
import { cn } from "@/lib/utils";

type FilterKey = "all" | LeadStatus;
type EventTypeFilter = "all" | string;

const SORT_OPTIONS: { value: LeadsListSort; label: string }[] = [
  { value: "newest",        label: "Most Recent" },
  { value: "oldest",        label: "Oldest" },
  { value: "az",            label: "A → Z" },
  { value: "za",            label: "Z → A" },
  { value: "event_asc",     label: "Event Date (Soonest)" },
  { value: "event_desc",    label: "Event Date (Latest)" },
  { value: "budget_high",   label: "Budget (Highest)" },
  { value: "budget_low",    label: "Budget (Lowest)" },
  { value: "last_contacted", label: "Last Contacted" },
  { value: "commitment_high", label: "Most Progress" },
];

type AttentionFilter =
  | "all"
  | "stale_contact"
  | "open"
  | "unseen"
  | "unattended_inquiry";

function stageDisplayName(lead: Lead): string {
  return salesStageLabel(lead.salesStage ?? lead.status);
}

function buildLeadsHref(opts: {
  q: string;
  status: string;
  eventType: string;
  sort: LeadsListSort;
  attention: AttentionFilter;
  outcome: "active" | "lost";
  page: number;
}): string {
  const sp = new URLSearchParams();
  if (opts.outcome === "lost" || opts.status === "lost") {
    sp.set("view", "lost");
  } else if (opts.status !== "all") {
    sp.set("stage", opts.status);
  }
  if (opts.q.trim()) sp.set("q", opts.q.trim());
  if (opts.eventType !== "all") sp.set("eventType", opts.eventType);
  if (opts.sort !== "newest") sp.set("sort", opts.sort);
  if (opts.attention === "stale_contact") sp.set("attention", "stale_contact");
  else if (opts.attention === "open") sp.set("attention", "open");
  else if (opts.attention === "unseen") sp.set("attention", "unseen");
  else if (opts.attention === "unattended_inquiry") {
    sp.set("attention", UNATTENDED_INQUIRY_ATTENTION);
  }
  if (opts.page > 1) sp.set("page", String(opts.page));
  const qs = sp.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

export function LeadList({
  leads,
  totalLeads,
  totalMatching,
  page,
  pageSize,
  totalPages,
  statusCounts: statusCountsIn,
  eventTypeCounts,
  initialAttention,
  initialOutcome = "active",
  initialQuery = "",
  initialStatus = "all",
  initialEventType = "all",
  initialSort = "newest",
  unattendedInquiryLeadIds = [],
  currentBookedCount = 0,
  messageAttentionByLeadId = {},
}: {
  /** Current server page only. */
  leads: Lead[];
  totalLeads: number;
  totalMatching: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<string, number>;
  eventTypeCounts: Array<[string, number]>;
  /** Dashboard/Luv deep-link: same 7-day stale-contact condition as generate_venue_recommendations. */
  initialAttention?: "stale_contact" | "open" | "active" | "unseen" | "unattended_inquiry" | null;
  /** lost = the Lost outcome list. Booked is a link to Clients, not a lead filter. */
  initialOutcome?: "active" | "lost";
  initialQuery?: string;
  initialStatus?: string;
  initialEventType?: string;
  initialSort?: LeadsListSort;
  /** Server-recomputed P-A1 qualifying IDs (same evaluator as the cluster). */
  unattendedInquiryLeadIds?: readonly string[];
  /** Current Booked membership — same population as Clients → All Bookings. */
  currentBookedCount?: number;
  /** Decision C — needs_response message attention, distinct from venue_seen_at. */
  messageAttentionByLeadId?: Record<string, LeadMessageAttention>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  void unattendedInquiryLeadIds;
  void pathname;

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<FilterKey>(
    (initialStatus as FilterKey) || (initialOutcome === "lost" ? "lost" : "all"),
  );
  const [eventTypeFilter, setEventTypeFilter] = React.useState<EventTypeFilter>(
    initialEventType || "all",
  );
  const [sort, setSort] = React.useState<LeadsListSort>(initialSort);
  const [attentionFilter, setAttentionFilter] = React.useState<AttentionFilter>(
    initialAttention === "active" ? "open" : (initialAttention ?? "all"),
  );

  React.useEffect(() => {
    setQuery(initialQuery);
    setStatusFilter((initialStatus as FilterKey) || (initialOutcome === "lost" ? "lost" : "all"));
    setEventTypeFilter(initialEventType || "all");
    setSort(initialSort);
    setAttentionFilter(initialAttention === "active" ? "open" : (initialAttention ?? "all"));
  }, [initialQuery, initialStatus, initialEventType, initialSort, initialAttention, initialOutcome]);

  const statusCounts = React.useMemo(() => {
    const map = new Map<string, number>(Object.entries(statusCountsIn));
    if (!map.has("booked")) map.set("booked", currentBookedCount);
    return map;
  }, [statusCountsIn, currentBookedCount]);

  type StageChip = { key: string; label: string; kind: "active" | "booked" | "lost" };
  const activeChips: StageChip[] = [
    { key: "all", label: "All", kind: "active" },
    ...LEAD_STATUSES.filter((s) => (ACTIVE_STATUSES as readonly string[]).includes(s.value)).map((s) => ({
      key: s.value,
      label: s.label,
      kind: "active" as const,
    })),
  ];
  const stageChips: StageChip[] = [
    ...activeChips,
    { key: "booked", label: "Booked", kind: "booked" },
    { key: "lost", label: "Lost", kind: "lost" },
  ];

  const hasActiveFilters =
    statusFilter !== "all" || eventTypeFilter !== "all" || query || attentionFilter !== "all";

  function navigate(next: {
    q?: string;
    status?: string;
    eventType?: string;
    sort?: LeadsListSort;
    attention?: AttentionFilter;
    outcome?: "active" | "lost";
    page?: number;
  }) {
    const href = buildLeadsHref({
      q: next.q ?? query,
      status: next.status ?? statusFilter,
      eventType: next.eventType ?? eventTypeFilter,
      sort: next.sort ?? sort,
      attention: next.attention ?? attentionFilter,
      outcome: next.outcome ?? (statusFilter === "lost" ? "lost" : "active"),
      page: next.page ?? 1,
    });
    router.replace(href);
  }

  function showAllActiveLeads() {
    setAttentionFilter("all");
    setStatusFilter("all");
    setQuery("");
    setEventTypeFilter("all");
    router.replace("/leads");
  }

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      if (query === initialQuery) return;
      navigate({ q: query, page: 1 });
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search only
  }, [query]);

  const queueEmpty = (statusCounts.get("all") ?? 0) === 0 && statusFilter !== "lost";

  return (
    <div className="space-y-4" data-testid="leads-list-root" data-leads-page={page} data-leads-page-size={pageSize} data-leads-total-matching={totalMatching}>
    <div className="space-y-3">
      {attentionFilter === "stale_contact" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.75rem] border border-[color:color-mix(in_oklch,var(--htc-soft-rose)_45%,var(--htc-border-warm))] bg-[var(--htc-soft-blush)] px-3 py-2 text-sm">
          <p className="text-foreground">
            Showing active leads with no contact in 7+ days.
          </p>
          <button
            type="button"
            onClick={() => showAllActiveLeads()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Show all active leads
          </button>
        </div>
      )}
      {attentionFilter === "open" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-foreground">
            Showing open leads — not booked, lost, won, or cancelled.
          </p>
          <button
            type="button"
            onClick={() => showAllActiveLeads()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Show all active leads
          </button>
        </div>
      )}
      {attentionFilter === "unseen" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-foreground">
            Showing unseen open leads — same population as the Leads navigation badge.
          </p>
          <button
            type="button"
            onClick={() => showAllActiveLeads()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Show all active leads
          </button>
        </div>
      )}
      {attentionFilter === "unattended_inquiry" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-foreground">
            Showing inquiries that still need a first venue response (48 hours–14 days).
          </p>
          <button
            type="button"
            onClick={() => showAllActiveLeads()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Show all active leads
          </button>
        </div>
      )}
      <div className="htc-hospitality-toolbar space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, event type…"
            className="border-[color:var(--htc-border-warm)] bg-card pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={sort}
            onValueChange={(v) => {
              const next = v as LeadsListSort;
              setSort(next);
              navigate({ sort: next, page: 1 });
            }}
            items={SORT_OPTIONS}
          >
            <SelectTrigger className="h-9 w-44 border-[color:var(--htc-border-warm)] bg-card text-sm text-muted-foreground">
              <SelectValue placeholder="Most Recent" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-muted-foreground font-medium mr-0.5">Stage:</span>
        {stageChips.map((chip) => {
          const count = statusCounts.get(chip.key) ?? 0;
          /* New Inquiry with population uses blush attention (Clients Needs Attention pattern). */
          const attentionIdle = chip.key === "new_inquiry" && count > 0;
          const chipClass = (active: boolean) =>
            cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active ? SELECTED_CHIP : attentionIdle ? ATTENTION_CHIP : IDLE_CHIP,
            );
          const countClass = (active: boolean) =>
            cn(
              "rounded-full px-1.5 py-px text-[10px] font-semibold",
              active ? SELECTED_CHIP_COUNT : attentionIdle ? ATTENTION_CHIP_COUNT : IDLE_CHIP_COUNT,
            );
          if (chip.kind === "booked") {
            return (
              <Link key={chip.key} href="/clients?filter=all" className={chipClass(false)}>
                {chip.label}
                <span className={countClass(false)}>{count}</span>
              </Link>
            );
          }
          const active = chip.key === "all"
            ? attentionFilter === "all" && statusFilter === "all"
            : statusFilter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                if (chip.key === "all") {
                  showAllActiveLeads();
                  return;
                }
                setStatusFilter(chip.key as FilterKey);
                if (chip.kind === "lost") {
                  setAttentionFilter("all");
                  navigate({ status: "lost", outcome: "lost", attention: "all", page: 1 });
                } else {
                  navigate({
                    status: chip.key,
                    outcome: "active",
                    page: 1,
                  });
                }
              }}
              className={chipClass(active)}
            >
              {chip.label}
              <span className={countClass(active)}>{count}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        All is active sales work. Booked and Lost are outcomes and are not included in All.
      </p>

      {eventTypeCounts.length > 1 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground font-medium mr-0.5">
            <SlidersHorizontal className="inline h-3 w-3 mr-1" />Type:
          </span>
          <button type="button" onClick={() => {
            setEventTypeFilter("all");
            navigate({ eventType: "all", page: 1 });
          }}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              eventTypeFilter === "all" ? SELECTED_CHIP : IDLE_CHIP,
            )}>
            All
          </button>
          {eventTypeCounts.map(([type, count]) => (
            <button key={type} type="button" onClick={() => {
              setEventTypeFilter(type);
              navigate({ eventType: type, page: 1 });
            }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                eventTypeFilter === type ? SELECTED_CHIP : IDLE_CHIP,
              )}>
              {eventTypeLabel(type)}
              <span className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-semibold",
                eventTypeFilter === type ? SELECTED_CHIP_COUNT : IDLE_CHIP_COUNT,
              )}>{count}</span>
            </button>
          ))}
        </div>
      )}
      </div>

      {hasActiveFilters && (
        <button type="button" onClick={() => {
          setQuery("");
          setStatusFilter("all");
          setEventTypeFilter("all");
          showAllActiveLeads();
        }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline">
          Clear all filters
        </button>
      )}

      {totalLeads === 0 && (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No leads yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            When a client reaches out, add them here to start tracking it.
          </p>
          <Button render={<Link href="/leads/new" />}>
            + New Lead
          </Button>
        </div>
      )}

      {statusFilter === "lost" && totalMatching === 0 && (statusCounts.get("lost") ?? 0) === 0 && totalLeads > 0 && (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No lost opportunities</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lost stays here as history. It is not part of All.
          </p>
        </div>
      )}

      {statusFilter !== "lost" && queueEmpty && totalLeads > 0 && (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No active leads</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Booked and Lost are outcomes. They are not in All.
          </p>
        </div>
      )}

      {statusFilter === "lost" && totalMatching === 0 && (statusCounts.get("lost") ?? 0) > 0 && (
        <div className="rounded-sm border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No lost opportunities match your filters.</p>
        </div>
      )}

      {statusFilter !== "lost" && !queueEmpty && totalMatching === 0 && (
        <div className="rounded-sm border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No leads match your filters.</p>
          <Button variant="link" size="sm" className="mt-1" onClick={() => {
            setQuery("");
            setStatusFilter("all");
            setEventTypeFilter("all");
            showAllActiveLeads();
          }}>
            Clear filters
          </Button>
        </div>
      )}

      {leads.length > 0 && (
        <div className="htc-hospitality-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const stage = lead.salesStage ?? lead.status;
                return (
                <TableRow key={lead.id} className="group">
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <LeadUnseenIndicator
                        venueSeenAt={lead.venueSeenAt}
                        salesStage={lead.salesStage ?? lead.status}
                      />
                      <LeadMessageAttentionIndicator
                        attention={messageAttentionByLeadId[lead.id] ?? null}
                      />
                      <Link href={`/leads/${lead.id}`} className="htc-record-link truncate">
                        {leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}
                      </Link>
                    </div>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.source ? sourceLabel(lead.source) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline">{stageDisplayName(lead)}</Badge>
                      {lead.commitmentScore > 0 && (() => {
                        const { tier } = momentumLabel(lead.commitmentScore, stage);
                        const dot = tier === "hot" ? "bg-success" : tier === "warm" ? "bg-[#C7A66A]" : tier === "growing" ? "bg-primary/50" : null;
                        return dot ? <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} title={`Commitment: ${lead.commitmentScore}`} /> : null;
                      })()}
                    </div>
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalMatching > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2" data-testid="leads-pagination">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalMatching)} of {totalMatching}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => navigate({ page: page - 1 })}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => navigate({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

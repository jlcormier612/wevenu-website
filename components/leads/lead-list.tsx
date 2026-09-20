"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";

import { LeadStatusBadge } from "@/components/leads/lead-status-badge";

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
  statusLabel,
} from "@/lib/leads/constants";
import { isOpenLeadLifecycle, isOpenLeadOpportunity } from "@/lib/leads/open-lifecycle";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import { normalizeEventType } from "@/lib/event-types/canonical";
import { isStaleWithoutContact } from "@/lib/leads/stale-contact";
import { resolveVenuePipelineStageId } from "@/lib/pipeline-templates/resolve-lead-stage";
import { transitionKindForCanonical } from "@/lib/leads/pipeline-stage-transition";
import type { PipelineStage } from "@/lib/pipeline-templates/types";
import type { SalesStage } from "@/lib/leads/sales-stages";
import { salesStageLabel } from "@/lib/leads/sales-stages";

type FilterKey = "all" | LeadStatus;
type EventTypeFilter = "all" | string;
type SortKey = "newest" | "oldest" | "az" | "za" | "event_asc" | "event_desc" | "budget_high" | "budget_low" | "last_contacted" | "commitment_high";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
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

function sortLeads(leads: Lead[], sort: SortKey): Lead[] {
  return [...leads].sort((a, b) => {
    switch (sort) {
      case "oldest":        return (a.inquiryDate ?? "") < (b.inquiryDate ?? "") ? -1 : 1;
      case "az":            return (a.firstName ?? "").localeCompare(b.firstName ?? "");
      case "za":            return (b.firstName ?? "").localeCompare(a.firstName ?? "");
      case "event_asc":     return (a.eventDate ?? "9999") < (b.eventDate ?? "9999") ? -1 : 1;
      case "event_desc":    return (b.eventDate ?? "") < (a.eventDate ?? "") ? -1 : 1;
      case "budget_high":   return (b.estimatedBudget ?? 0) - (a.estimatedBudget ?? 0);
      case "budget_low":    return (a.estimatedBudget ?? 0) - (b.estimatedBudget ?? 0);
      case "last_contacted":return (b.lastContactedAt ?? "") < (a.lastContactedAt ?? "") ? -1 : 1;
      case "commitment_high": return (b.commitmentScore ?? 0) - (a.commitmentScore ?? 0);
      default:              return (b.inquiryDate ?? "") < (a.inquiryDate ?? "") ? -1 : 1;
    }
  });
}

export function LeadList({
  leads,
  initialAttention,
  venueStages = null,
  initialOutcome = "active",
}: {
  leads: Lead[];
  /** Dashboard/Luv deep-link: same 7-day stale-contact condition as generate_venue_recommendations. */
  initialAttention?: "stale_contact" | "open" | "active" | "unseen" | null;
  /** Active Pipeline Template stages — when present, Stage chips use venue names. */
  venueStages?: PipelineStage[] | null;
  /** lost = the Lost outcome list. Booked is a link to Clients, not a lead filter. */
  initialOutcome?: "active" | "lost";
}) {
  const router = useRouter();
  const usingVenueStages = (venueStages?.length ?? 0) > 0;
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>(initialOutcome === "lost" ? "lost" : "all");
  const [eventTypeFilter, setEventTypeFilter] = React.useState<EventTypeFilter>("all");
  const [sort, setSort] = React.useState<SortKey>(
    initialAttention === "stale_contact" ? "last_contacted" : "newest",
  );
  const [attentionFilter, setAttentionFilter] = React.useState<"all" | "stale_contact" | "open" | "unseen">(
    initialAttention === "stale_contact" ? "stale_contact"
      : initialAttention === "open" ? "open"
      : initialAttention === "unseen" ? "unseen"
      : "all",
  );

  const queue = React.useMemo(
    () => leads.filter((l) => isOpenLeadLifecycle(l.salesStage ?? l.status)),
    [leads],
  );

  const workingVenueStages = venueStages?.length
    ? venueStages.filter((s) => transitionKindForCanonical(s.canonicalStage) === "normal")
    : null;
  const usingWorkingVenueStages = (workingVenueStages?.length ?? 0) > 0;
  const bookedStageName = venueStages?.find((s) => s.canonicalStage === "booked")?.name ?? "Booked";
  const lostStageName = venueStages?.find((s) => s.canonicalStage === "lost")?.name ?? "Lost";

  function isLostLead(lead: Lead): boolean {
    return String(lead.salesStage ?? lead.status) === "lost";
  }
  function isBookedLead(lead: Lead): boolean {
    const stage = String(lead.salesStage ?? lead.status);
    return stage === "booked" || stage === "won";
  }

  function venueStageIdFor(lead: Lead): string | null {
    if (!workingVenueStages?.length) return null;
    return resolveVenuePipelineStageId(workingVenueStages, {
      pipelineStageId: lead.pipelineStageId,
      salesStage: (lead.salesStage ?? lead.status) as SalesStage,
    });
  }

  /** Same open definition as Dashboard Lead Flow — reporting category, not exclude flag. */
  function leadIsOpenOpportunity(lead: Lead): boolean {
    if (usingVenueStages && venueStages?.length) {
      const id = venueStageIdFor(lead);
      const stage = venueStages.find((s) => s.id === id);
      if (stage) {
        return isOpenLeadOpportunity({
          salesStage: lead.salesStage ?? lead.status,
          canonicalStage: stage.canonicalStage,
        });
      }
    }
    return isOpenLeadOpportunity({ salesStage: lead.salesStage ?? lead.status });
  }

  function stageDisplayName(lead: Lead): string {
    if (venueStages?.length) {
      const id = venueStageIdFor(lead);
      const named = venueStages.find((s) => s.id === id)?.name;
      if (named) return named;
    }
    return salesStageLabel(lead.salesStage ?? lead.status) || statusLabel(lead.salesStage ?? lead.status);
  }

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const nowMs = Date.now();
    const base = (statusFilter === "lost" ? leads.filter(isLostLead) : queue).filter((l) => {
      const stage = l.salesStage ?? l.status;
      if (statusFilter !== "all" && statusFilter !== "lost") {
        if (usingWorkingVenueStages) {
          if (venueStageIdFor(l) !== statusFilter) return false;
        } else if (stage !== statusFilter) {
          return false;
        }
      }
      if (eventTypeFilter !== "all") {
        // Group by canonical key so "Wedding" / "wedding" never become two filters.
        if (normalizeEventType(l.eventType) !== eventTypeFilter) return false;
      }
      if (attentionFilter === "stale_contact") {
        // Same open-lifecycle + opportunity-age rule as generate_venue_recommendations
        // (coalesce last contact → inquiry → created; never treat null contact as ancient).
        if (!leadIsOpenOpportunity(l)) {
          return false;
        }
        if (l.excludeFromBusinessReporting) return false;
        if (!isStaleWithoutContact({
          lastContactedAt: l.lastContactedAt,
          inquiryDate: l.inquiryDate,
          createdAt: l.createdAt,
        }, nowMs)) {
          return false;
        }
      }
      if (attentionFilter === "open") {
        // Same open-lead definition as Dashboard Lead Flow (non-terminal reporting category).
        if (!leadIsOpenOpportunity(l)) return false;
      }
      if (attentionFilter === "unseen") {
        // Same population as Leads nav attention badge (open + venue_seen_at null).
        if (l.venueSeenAt) return false;
        if (!leadIsOpenOpportunity(l)) return false;
      }
      if (!q) return true;
      return [
        l.firstName, l.lastName, l.partnerFirstName, l.partnerLastName,
        l.email, l.phone, l.eventType, l.source,
      ].some((v) => v?.toLowerCase().includes(q));
    });
    return sortLeads(base, sort);
  }, [queue, leads, query, statusFilter, eventTypeFilter, sort, attentionFilter, usingWorkingVenueStages]);

  const statusCounts = React.useMemo(() => {
    const population = attentionFilter === "open" || attentionFilter === "unseen"
      ? queue.filter((l) => {
        if (!leadIsOpenOpportunity(l)) return false;
        if (attentionFilter === "unseen" && l.venueSeenAt) return false;
        return true;
      })
      : queue;
    const map = new Map<string, number>([["all", population.length]]);
    if (usingWorkingVenueStages && workingVenueStages) {
      for (const s of workingVenueStages) map.set(s.id, 0);
      for (const l of population) {
        const id = resolveVenuePipelineStageId(workingVenueStages, {
          pipelineStageId: l.pipelineStageId,
          salesStage: (l.salesStage ?? l.status) as SalesStage,
        });
        if (id && map.has(id)) map.set(id, (map.get(id) ?? 0) + 1);
      }
    } else {
      ACTIVE_STATUSES.forEach((s) => map.set(s, 0));
      population.forEach((l) => {
        const stage = l.salesStage ?? l.status;
        map.set(stage, (map.get(stage) ?? 0) + 1);
      });
    }
    map.set("booked", leads.filter(isBookedLead).length);
    map.set("lost", leads.filter(isLostLead).length);
    return map;
  }, [queue, leads, usingWorkingVenueStages, workingVenueStages, attentionFilter]);

  type StageChip = { key: string; label: string; kind: "active" | "booked" | "lost" };
  const activeChips: StageChip[] = usingWorkingVenueStages && workingVenueStages
    ? [{ key: "all", label: "All", kind: "active" }, ...workingVenueStages.map((s) => ({ key: s.id, label: s.name, kind: "active" as const }))]
    : [{ key: "all", label: "All", kind: "active" }, ...LEAD_STATUSES.filter((s) => (ACTIVE_STATUSES as readonly string[]).includes(s.value)).map((s) => ({ key: s.value, label: s.label, kind: "active" as const }))];
  const stageChips: StageChip[] = [
    ...activeChips,
    { key: "booked", label: bookedStageName, kind: "booked" },
    { key: "lost", label: lostStageName, kind: "lost" },
  ];

  const activeEventTypes = React.useMemo(() => {
    const population = attentionFilter === "open" || attentionFilter === "unseen"
      ? queue.filter((l) => {
        if (!leadIsOpenOpportunity(l)) return false;
        if (attentionFilter === "unseen" && l.venueSeenAt) return false;
        return true;
      })
      : queue;
    const seen = new Map<string, number>();
    population.forEach((l) => {
      const key = normalizeEventType(l.eventType);
      if (!key) return;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [queue, attentionFilter]);

  const hasActiveFilters =
    statusFilter !== "all" || eventTypeFilter !== "all" || query || attentionFilter !== "all";

  return (
    <div className="space-y-4">
    <div className="space-y-3">
      {attentionFilter === "stale_contact" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/50 bg-rose-50/40 px-3 py-2 text-sm">
          <p className="text-foreground">
            Showing active leads with no contact in 7+ days.
          </p>
          <button
            type="button"
            onClick={() => setAttentionFilter("all")}
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
            onClick={() => setAttentionFilter("all")}
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
            onClick={() => setAttentionFilter("all")}
            className="text-xs font-medium text-primary hover:underline"
          >
            Show all active leads
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, event type…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)} items={SORT_OPTIONS}>
            <SelectTrigger className="h-9 w-44 text-sm border-border">
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
          const chipClass = (active: boolean) =>
            `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`;
          const countClass = (active: boolean) =>
            `rounded-full px-1.5 py-px text-[10px] font-semibold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`;
          if (chip.kind === "booked") {
            return (
              <Link key={chip.key} href="/clients?filter=all" className={chipClass(false)}>
                {chip.label}
                <span className={countClass(false)}>{count}</span>
              </Link>
            );
          }
          const active = statusFilter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                setStatusFilter(chip.key);
                if (chip.kind === "lost") router.replace("/leads?view=lost");
                else if (initialOutcome === "lost") router.replace("/leads");
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
        All is active sales work. {bookedStageName} and {lostStageName} are outcomes and are not included in All.
      </p>

      {activeEventTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground font-medium mr-0.5">
            <SlidersHorizontal className="inline h-3 w-3 mr-1" />Type:
          </span>
          <button type="button" onClick={() => setEventTypeFilter("all")}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${eventTypeFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
            All
          </button>
          {activeEventTypes.map(([type, count]) => (
            <button key={type} type="button" onClick={() => setEventTypeFilter(type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${eventTypeFilter === type ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
              {eventTypeLabel(type)}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${eventTypeFilter === type ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {hasActiveFilters && (
        <button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); setEventTypeFilter("all"); setAttentionFilter("all"); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline">
          Clear all filters
        </button>
      )}

      {leads.length === 0 && (
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

      {statusFilter === "lost" && filtered.length === 0 && (statusCounts.get("lost") ?? 0) === 0 && leads.length > 0 && (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No lost opportunities</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lost stays here as history. It is not part of All.
          </p>
        </div>
      )}

      {statusFilter !== "lost" && queue.length === 0 && leads.length > 0 && (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No active leads</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Booked and Lost are outcomes. They are not in All.
          </p>
        </div>
      )}

      {statusFilter === "lost" && filtered.length === 0 && (statusCounts.get("lost") ?? 0) > 0 && (
        <div className="rounded-sm border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No lost opportunities match your filters.</p>
        </div>
      )}

      {statusFilter !== "lost" && queue.length > 0 && filtered.length === 0 && (
        <div className="rounded-sm border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No leads match your filters.</p>
          <Button variant="link" size="sm" className="mt-1" onClick={() => { setQuery(""); setStatusFilter("all"); setEventTypeFilter("all"); }}>
            Clear filters
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-sm border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => {
                const stage = lead.salesStage ?? lead.status;
                return (
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
                    <div className="flex items-center gap-1.5">
                      {usingVenueStages ? (
                        <Badge variant="outline">{stageDisplayName(lead)}</Badge>
                      ) : (
                        <LeadStatusBadge status={stage} />
                      )}
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
    </div>
    </div>
  );
}

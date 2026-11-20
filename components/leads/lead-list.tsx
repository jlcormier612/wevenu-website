"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";

function momentumLabel(score: number, status: string): { tier: "hot" | "warm" | "growing" | "early" | "quiet" } {
  if (status === "booked" || status === "won") return { tier: "hot" };
  if (status === "lost" || status === "cancelled") return { tier: "quiet" };
  if (score >= 70) return { tier: "hot" };
  if (score >= 45) return { tier: "warm" };
  if (score >= 20) return { tier: "growing" };
  return { tier: "early" };
}

import { loadMoreLeadsAction } from "@/app/(app)/leads/actions";
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
import type { LeadsListAttention, LeadsListSort } from "@/lib/leads/list-query";
import { LEADS_PAGE_SIZE } from "@/lib/leads/list-query";
import {
  appendLeadWindow,
  buildLeadsListHref,
  leadsFilterFingerprint,
  nextSearchDraftFromCommitted,
  progressiveWindowLabel,
  shouldApplyLoadMoreResult,
  shouldCommitSearchDraft,
} from "@/lib/leads/list-navigation";
import {
  clearLeadsListSession,
  readLeadsListSession,
  saveLeadsListWorkingContext,
} from "@/lib/leads/list-session.client";
import {
  planLeadsListRestore,
  shouldPersistLeadsListSession,
  type LeadsListRestorePhase,
} from "@/lib/leads/list-session";
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

type AttentionFilter = LeadsListAttention;

function stageDisplayName(lead: Lead): string {
  return salesStageLabel(lead.salesStage ?? lead.status);
}

export function LeadList({
  leads: initialLeads,
  totalLeads,
  totalMatching: initialTotalMatching,
  pageSize = LEADS_PAGE_SIZE,
  hasMore: initialHasMore,
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
  messageAttentionByLeadId: initialMessageAttention = {},
  indexError = null,
}: {
  /** First progressive window from the server. */
  leads: Lead[];
  totalLeads: number;
  totalMatching: number;
  pageSize?: number;
  hasMore: boolean;
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
  /** Recoverable index failure — never show partial counts as complete. */
  indexError?: string | null;
}) {
  const router = useRouter();
  void unattendedInquiryLeadIds;

  const committedAttention: AttentionFilter =
    initialAttention === "active" ? "open" : (initialAttention ?? "all");
  const committedStatus =
    (initialStatus as FilterKey) || (initialOutcome === "lost" ? "lost" : "all");
  const committedOutcome = initialOutcome === "lost" || committedStatus === "lost"
    ? ("lost" as const)
    : ("active" as const);

  const committed = {
    q: initialQuery,
    status: committedStatus,
    eventType: initialEventType || "all",
    sort: initialSort,
    attention: committedAttention,
    outcome: committedOutcome,
  };

  const fingerprint = leadsFilterFingerprint(committed);

  const [queryDraft, setQueryDraft] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<FilterKey>(committedStatus);
  const [eventTypeFilter, setEventTypeFilter] = React.useState<EventTypeFilter>(
    committed.eventType,
  );
  const [sort, setSort] = React.useState<LeadsListSort>(committed.sort);
  const [attentionFilter, setAttentionFilter] = React.useState<AttentionFilter>(
    committed.attention,
  );

  const [displayedLeads, setDisplayedLeads] = React.useState<Lead[]>(initialLeads);
  const [totalMatching, setTotalMatching] = React.useState(initialTotalMatching);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [messageAttentionByLeadId, setMessageAttentionByLeadId] = React.useState(
    initialMessageAttention,
  );
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);

  const lastRequestedQueryRef = React.useRef(initialQuery);
  const searchGenRef = React.useRef(0);
  const loadMoreGenRef = React.useRef(0);
  const fingerprintRef = React.useRef(fingerprint);
  fingerprintRef.current = fingerprint;
  const restoredFingerprintRef = React.useRef<string | null>(null);
  const restorePhaseRef = React.useRef<LeadsListRestorePhase>("idle");
  const [restoreSettled, setRestoreSettled] = React.useState(false);
  const displayedLeadsRef = React.useRef(displayedLeads);
  displayedLeadsRef.current = displayedLeads;

  function persistWorkingContext(
    leadIds?: readonly string[],
    opts?: { force?: boolean; scrollY?: number },
  ) {
    if (typeof window === "undefined") return;
    const ids = leadIds ?? displayedLeadsRef.current.map((l) => l.id);
    const existing = readLeadsListSession();
    if (
      !shouldPersistLeadsListSession({
        phase: restorePhaseRef.current,
        force: opts?.force,
        existing,
        nextLeadIds: ids,
        fingerprint,
      })
    ) {
      return;
    }
    saveLeadsListWorkingContext({
      href: buildLeadsListHref(committed),
      fingerprint,
      leadIds: ids,
      scrollY: opts?.scrollY ?? window.scrollY,
    });
  }

  // Sync draft/chips from committed URL without clobbering newer keystrokes.
  React.useEffect(() => {
    setStatusFilter(committedStatus);
    setEventTypeFilter(committed.eventType);
    setSort(committed.sort);
    setAttentionFilter(committed.attention);
    setQueryDraft((draft) =>
      nextSearchDraftFromCommitted({
        draft,
        committedUrlQuery: initialQuery,
        lastRequestedQuery: lastRequestedQueryRef.current,
      }),
    );
    lastRequestedQueryRef.current = initialQuery;
  }, [
    fingerprint,
    initialQuery,
    committedStatus,
    committed.eventType,
    committed.sort,
    committed.attention,
  ]);

  // Filter/search/sort change → restart progressive window at first chunk.
  React.useEffect(() => {
    loadMoreGenRef.current += 1;
    restoredFingerprintRef.current = null;
    restorePhaseRef.current = "idle";
    setRestoreSettled(false);
    setDisplayedLeads(initialLeads);
    setTotalMatching(initialTotalMatching);
    setHasMore(initialHasMore);
    setMessageAttentionByLeadId(initialMessageAttention);
    setLoadingMore(false);
    setLoadMoreError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when filter fingerprint changes
  }, [fingerprint]);

  // Wave 1: restore progressive window + scroll when returning with matching filters.
  // Pending restore must not be overwritten by the scroll/persist effect (20-row clobber).
  React.useEffect(() => {
    if (indexError) {
      restorePhaseRef.current = "done";
      setRestoreSettled(true);
      return;
    }
    if (restoredFingerprintRef.current === fingerprint) return;

    const session = readLeadsListSession();
    const serverFirstIds = initialLeads.map((l) => l.id);
    const plan = planLeadsListRestore({
      session,
      urlFingerprint: fingerprint,
      serverFirstIds,
      pageSize,
    });

    if (plan.action === "use_server_window") {
      // Authoritative first window — safe to persist; URL filters already apply.
      restorePhaseRef.current = "done";
      restoredFingerprintRef.current = fingerprint;
      persistWorkingContext(serverFirstIds, { force: true });
      setRestoreSettled(true);
      return;
    }

    restorePhaseRef.current = "pending";
    restoredFingerprintRef.current = fingerprint;
    const gen = ++loadMoreGenRef.current;
    const pendingScrollY = plan.scrollY;
    let cancelled = false;
    setLoadingMore(true);
    setLoadMoreError(null);

    void (async () => {
      try {
        const result = await loadMoreLeadsAction({
          q: committed.q,
          status: committed.status,
          eventType: committed.eventType,
          sort: committed.sort,
          attention: committed.attention,
          outcome: committed.outcome,
          excludeIds: [],
          filterFingerprint: fingerprint,
          limit: plan.limit,
        });
        if (cancelled) {
          // Navigation away / fingerprint change — leave saved session intact.
          return;
        }
        if (
          !shouldApplyLoadMoreResult({
            requestGeneration: gen,
            currentGeneration: loadMoreGenRef.current,
            requestFingerprint: fingerprint,
            currentFingerprint: fingerprintRef.current,
          })
        ) {
          return;
        }
        if (!result.ok) {
          // Fall back to authoritative first 20 already on screen.
          setDisplayedLeads(initialLeads);
          setTotalMatching(initialTotalMatching);
          setHasMore(initialHasMore);
          setMessageAttentionByLeadId(initialMessageAttention);
          setLoadMoreError(null);
          restorePhaseRef.current = "done";
          persistWorkingContext(serverFirstIds, { force: true });
          setRestoreSettled(true);
          return;
        }
        setDisplayedLeads(result.leads);
        setTotalMatching(result.totalMatching);
        setHasMore(result.hasMore);
        setMessageAttentionByLeadId(result.messageAttentionByLeadId);
        restorePhaseRef.current = "done";
        persistWorkingContext(result.leads.map((l) => l.id), {
          force: true,
          scrollY: pendingScrollY,
        });
        setRestoreSettled(true);
        requestAnimationFrame(() => {
          window.scrollTo(0, pendingScrollY);
        });
      } catch {
        if (cancelled) return;
        setDisplayedLeads(initialLeads);
        setTotalMatching(initialTotalMatching);
        setHasMore(initialHasMore);
        setMessageAttentionByLeadId(initialMessageAttention);
        setLoadMoreError(null);
        restorePhaseRef.current = "done";
        persistWorkingContext(serverFirstIds, { force: true });
        setRestoreSettled(true);
      } finally {
        if (!cancelled) setLoadingMore(false);
      }
    })();

    return () => {
      cancelled = true;
      // Strict Mode remount / nav away mid-flight: do not leave phase stuck
      // pending with restoredFingerprint set (that would skip a real restore).
      // Session stays intact — cancelled restore must not clobber storage.
      if (restorePhaseRef.current === "pending") {
        restorePhaseRef.current = "idle";
        restoredFingerprintRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per fingerprint
  }, [fingerprint, indexError]);

  // Persist scroll/href only after restore has settled — never clobber a larger session.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!restoreSettled) return;
    const onScroll = () => {
      persistWorkingContext();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    persistWorkingContext();
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle + row count
  }, [fingerprint, displayedLeads.length, restoreSettled]);

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
    statusFilter !== "all" || eventTypeFilter !== "all" || queryDraft || attentionFilter !== "all";

  function navigateCommitted(next: Partial<{
    q: string;
    status: string;
    eventType: string;
    sort: LeadsListSort;
    attention: AttentionFilter;
    outcome: "active" | "lost";
  }>) {
    const href = buildLeadsListHref({
      q: next.q ?? committed.q,
      status: next.status ?? committed.status,
      eventType: next.eventType ?? committed.eventType,
      sort: next.sort ?? committed.sort,
      attention: next.attention ?? committed.attention,
      outcome: next.outcome ?? committed.outcome,
    });
    if (next.q != null) lastRequestedQueryRef.current = next.q;
    router.replace(href);
  }

  function showAllActiveLeads() {
    searchGenRef.current += 1;
    lastRequestedQueryRef.current = "";
    setQueryDraft("");
    setAttentionFilter("all");
    setStatusFilter("all");
    setEventTypeFilter("all");
    clearLeadsListSession();
    router.replace("/leads");
  }

  // Debounced search — generation-gated so stale timers cannot overwrite newer drafts.
  React.useEffect(() => {
    const generation = ++searchGenRef.current;
    const handle = window.setTimeout(() => {
      if (
        !shouldCommitSearchDraft({
          draft: queryDraft,
          committedUrlQuery: initialQuery,
          generation,
          currentGeneration: searchGenRef.current,
        })
      ) {
        return;
      }
      lastRequestedQueryRef.current = queryDraft;
      navigateCommitted({ q: queryDraft });
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce draft only
  }, [queryDraft]);

  async function onShowMore() {
    if (loadingMore || !hasMore || indexError) return;
    const gen = ++loadMoreGenRef.current;
    const requestFingerprint = fingerprint;
    const excludeIds = displayedLeads.map((l) => l.id);
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await loadMoreLeadsAction({
        q: committed.q,
        status: committed.status,
        eventType: committed.eventType,
        sort: committed.sort,
        attention: committed.attention,
        outcome: committed.outcome,
        excludeIds,
        filterFingerprint: requestFingerprint,
        limit: pageSize,
      });
      if (
        !shouldApplyLoadMoreResult({
          requestGeneration: gen,
          currentGeneration: loadMoreGenRef.current,
          requestFingerprint,
          currentFingerprint: fingerprintRef.current,
        })
      ) {
        return;
      }
      if (!result.ok) {
        setLoadMoreError(result.message);
        return;
      }
      if (result.filterFingerprint !== fingerprintRef.current) return;
      setDisplayedLeads((prev) => {
        const next = appendLeadWindow(prev, result.leads);
        persistWorkingContext(next.map((l) => l.id));
        return next;
      });
      setMessageAttentionByLeadId((prev) => ({
        ...prev,
        ...result.messageAttentionByLeadId,
      }));
      setTotalMatching(result.totalMatching);
      setHasMore(result.hasMore);
    } catch {
      if (gen !== loadMoreGenRef.current) return;
      setLoadMoreError("Could not load more leads. Try again.");
    } finally {
      if (gen === loadMoreGenRef.current) setLoadingMore(false);
    }
  }

  const queueEmpty = (statusCounts.get("all") ?? 0) === 0 && statusFilter !== "lost";
  const showProgressive = totalMatching > 0 && displayedLeads.length > 0;

  if (indexError) {
    return (
      <div
        className="rounded-[0.75rem] border border-[color:color-mix(in_oklch,var(--htc-soft-rose)_45%,var(--htc-border-warm))] bg-[var(--htc-soft-blush)] px-4 py-6 text-center"
        role="alert"
        data-testid="leads-index-error"
      >
        <p className="font-heading text-base font-medium text-heading">Leads list unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">{indexError}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.refresh()}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      data-testid="leads-list-root"
      data-leads-page-size={pageSize}
      data-leads-shown={displayedLeads.length}
      data-leads-total-matching={totalMatching}
    >
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
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
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
              navigateCommitted({ sort: next, q: queryDraft });
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
                  navigateCommitted({
                    status: "lost",
                    outcome: "lost",
                    attention: "all",
                    q: queryDraft,
                  });
                } else {
                  navigateCommitted({
                    status: chip.key,
                    outcome: "active",
                    q: queryDraft,
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
            navigateCommitted({ eventType: "all", q: queryDraft });
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
              navigateCommitted({ eventType: type, q: queryDraft });
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
        <button type="button" onClick={() => showAllActiveLeads()}
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
          <Button variant="link" size="sm" className="mt-1" onClick={() => showAllActiveLeads()}>
            Clear filters
          </Button>
        </div>
      )}

      {displayedLeads.length > 0 && (
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
              {displayedLeads.map((lead) => {
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
                      <Link
                        href={`/leads/${lead.id}`}
                        prefetch={false}
                        className="htc-record-link truncate"
                        onClick={() => persistWorkingContext()}
                      >
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
                    <Button
                      variant="ghost"
                      size="sm"
                      render={
                        <Link
                          href={`/leads/${lead.id}`}
                          prefetch={false}
                          onClick={() => persistWorkingContext()}
                        />
                      }
                    >
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

      {showProgressive && (
        <div
          className="flex flex-col items-center gap-2 pt-2"
          data-testid="leads-progressive"
        >
          <p className="text-xs text-muted-foreground" data-testid="leads-showing-label">
            {progressiveWindowLabel(displayedLeads.length, totalMatching)}
          </p>
          {hasMore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => void onShowMore()}
              data-testid="leads-show-more"
              className="border-[color:var(--htc-border-warm)]"
            >
              {loadingMore ? "Loading…" : "Show 20 more ↓"}
            </Button>
          )}
          {loadMoreError && (
            <p className="text-xs text-destructive" role="alert">{loadMoreError}</p>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

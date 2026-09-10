"use client";

/**
 * ConversationInbox — communication workspace (list | conversation).
 * Server-side pagination, search, and progressive filters. No dossier panel.
 */

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Filter, Paperclip, Search, X } from "lucide-react";

import {
  getConversationInboxPageAction,
  getInboxFilterEventLabelAction,
  searchInboxFilterEventsAction,
} from "@/app/(app)/messaging/actions";
import { CHANNEL_META, ConversationThread } from "@/components/conversations/conversation-thread";
import {
  conversationNeedsResponseFromSummary,
  isMeaningfulCommunication,
} from "@/lib/conversations/inbox-attention";
import {
  clearInboxChip,
  defaultInboxFilters,
  INBOX_EVENT_DATE_PRESET_OPTIONS,
  INBOX_EVENT_TYPE_OPTIONS,
  INBOX_FILTER_ALL,
  INBOX_SORT_OPTIONS,
  inboxActiveChips,
  inboxFiltersAreDefault,
  inboxFiltersToQuery,
  toggleInboxEventType,
  type InboxEventDatePreset,
  type InboxFilterState,
  type InboxSort,
} from "@/lib/conversations/inbox-filters";
import { formatInboxListEventCue } from "@/lib/conversations/inbox-header";
import type { ConversationMessagePreview, ConversationSummary } from "@/lib/conversations/types";
import type { StaffMember } from "@/lib/team/types";

type InboxEventOption = {
  id: string;
  name: string;
  eventDate: string | null;
  status: string;
};

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(/[\s&]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function formatListTime(iso: string | null, nowMs: number | null): string {
  if (!iso || nowMs == null) return "";
  const t = new Date(iso).getTime();
  const diff = nowMs - t;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function needsResponseForRow(
  conversation: ConversationSummary,
  overrides: Record<string, boolean>,
): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, conversation.id)) {
    return overrides[conversation.id]!;
  }
  return conversationNeedsResponseFromSummary(conversation);
}

function ConversationRow({
  conversation, isActive, needsResponse, timeLabel, onClick,
}: {
  conversation: ConversationSummary;
  isActive: boolean;
  needsResponse: boolean;
  timeLabel: string;
  onClick: () => void;
}) {
  const meaningful = conversation.latestMeaningfulMessage ?? conversation.latestMessage;
  const preview = meaningful && isMeaningfulCommunication(meaningful)
    ? meaningful
    : conversation.latestMessage;
  const previewText = preview
    ? `${preview.senderType === "venue_staff" ? "You: " : ""}${preview.body || (preview.channel === "sms" ? "Photo or file" : "Attachment")}`
    : "No messages yet";
  const ChannelIcon = preview ? CHANNEL_META[preview.channel]?.icon : null;
  const eventCue = formatInboxListEventCue(conversation);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 border-b border-border/40 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 ${isActive ? "border-l-2 border-l-primary bg-primary/5" : ""}`}
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span className="text-xs font-semibold text-primary">{initials(conversation.displayName)}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm font-medium ${conversation.venueUnread > 0 ? "text-heading" : "text-foreground"}`}>
            {conversation.displayName ?? "Unnamed relationship"}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground">{timeLabel}</span>
        </div>
        {eventCue && (
          <p className="truncate text-[11px] text-muted-foreground">{eventCue}</p>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium">
            {conversation.clientId ? "Booking" : "Lead"}
          </span>
          {ChannelIcon && <ChannelIcon className="h-3 w-3" aria-hidden />}
          {conversation.hasAttachments && (
            <Paperclip className="h-3 w-3" aria-label="Has attachments" />
          )}
          {needsResponse && (
            <span className="rounded-full bg-warning/20 px-1.5 py-0.5 font-medium text-warning-foreground">
              Needs response
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-xs ${conversation.venueUnread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {previewText}
          </p>
          {conversation.venueUnread > 0 && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {conversation.venueUnread > 9 ? "9+" : conversation.venueUnread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function ConversationInbox({
  teamMembers = [],
  currentStaffId = null,
}: {
  teamMembers?: StaffMember[];
  currentStaffId?: string | null;
}) {
  const searchParams = useSearchParams();
  const [items, setItems] = React.useState<ConversationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<{
    lastMessageAt: string | null;
    id: string;
    sortKey?: string | null;
  } | null>(null);
  const [totalUnread, setTotalUnread] = React.useState(0);
  const [needsResponseOverrides, setNeedsResponseOverrides] = React.useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = React.useState<string | null>(() => searchParams.get("conversation"));
  const [nowMs, setNowMs] = React.useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  React.useEffect(() => {
    const fromUrl = searchParams.get("conversation");
    if (fromUrl) setActiveId(fromUrl);
  }, [searchParams]);

  const [search, setSearch] = React.useState("");
  const [searchDebounced, setSearchDebounced] = React.useState("");
  const [filters, setFilters] = React.useState<InboxFilterState>(defaultInboxFilters);
  const [eventSearch, setEventSearch] = React.useState("");
  const [eventSearchResults, setEventSearchResults] = React.useState<InboxEventOption[]>([]);
  const [eventSearchPending, setEventSearchPending] = React.useState(false);
  const [selectedEventLabel, setSelectedEventLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNowMs(Date.now());
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    const q = eventSearch.trim();
    if (q.length < 2) {
      setEventSearchResults([]);
      setEventSearchPending(false);
      return;
    }
    setEventSearchPending(true);
    const t = setTimeout(() => {
      void searchInboxFilterEventsAction(q)
        .then(setEventSearchResults)
        .catch(() => setEventSearchResults([]))
        .finally(() => setEventSearchPending(false));
    }, 250);
    return () => clearTimeout(t);
  }, [eventSearch]);

  React.useEffect(() => {
    if (filters.eventId === INBOX_FILTER_ALL) {
      setSelectedEventLabel(null);
      return;
    }
    void getInboxFilterEventLabelAction(filters.eventId)
      .then((label) => setSelectedEventLabel(label))
      .catch(() => setSelectedEventLabel("Selected event"));
  }, [filters.eventId]);

  const queryFields = React.useMemo(
    () => inboxFiltersToQuery(filters, currentStaffId),
    [filters, currentStaffId],
  );

  const queryKey = React.useMemo(
    () => JSON.stringify({ searchDebounced, queryFields }),
    [searchDebounced, queryFields],
  );

  const hasActiveFilters = !inboxFiltersAreDefault(filters) || !!searchDebounced.trim();

  const staffLabel = React.useMemo(() => {
    if (filters.assignment.mode !== "staff") return null;
    const staffId = filters.assignment.staffId;
    return teamMembers.find((m) => m.id === staffId)?.name ?? null;
  }, [filters.assignment, teamMembers]);

  const chips = inboxActiveChips(filters, {
    eventLabel: selectedEventLabel,
    staffLabel,
  });

  const loadPage = React.useCallback(async (mode: "replace" | "append") => {
    if (mode === "replace") setLoading(true);
    else setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await getConversationInboxPageAction({
        limit: 40,
        cursorLastMessageAt: mode === "append" ? nextCursor?.lastMessageAt : null,
        cursorId: mode === "append" ? nextCursor?.id : null,
        cursorSortKey: mode === "append" ? nextCursor?.sortKey : null,
        search: searchDebounced || null,
        ...queryFields,
      });
      setItems((prev) => (mode === "append" ? [...prev, ...page.conversations] : page.conversations));
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setTotalUnread(page.totalUnread);
      if (mode === "replace") setNeedsResponseOverrides({});
    } catch {
      setLoadError("Couldn’t load conversations. Try again.");
      if (mode === "replace") setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nextCursor only for append
  }, [searchDebounced, queryFields, nextCursor]);

  React.useEffect(() => {
    setNextCursor(null);
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const page = await getConversationInboxPageAction({
          limit: 40,
          search: searchDebounced || null,
          ...queryFields,
        });
        setItems(page.conversations);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
        setTotalUnread(page.totalUnread);
        setNeedsResponseOverrides({});
      } catch {
        setLoadError("Couldn’t load conversations. Try again.");
        setItems([]);
        setHasMore(false);
        setNextCursor(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSummary = items.find((c) => c.id === activeId) ?? null;
  const needsResponseCount = items.filter((c) => needsResponseForRow(c, needsResponseOverrides)).length;

  function markConversationOpened(conversationId: string, needsResponse: boolean) {
    setItems((prev) => prev.map((c) => (
      c.id === conversationId ? { ...c, venueUnread: 0 } : c
    )));
    setNeedsResponseOverrides((prev) => ({ ...prev, [conversationId]: needsResponse }));
  }

  function markConversationSent(
    conversationId: string,
    latestMessage: ConversationMessagePreview,
    needsResponse: boolean,
  ) {
    setItems((prev) => prev.map((c) => (
      c.id === conversationId
        ? {
            ...c,
            latestMessage,
            latestMeaningfulMessage: isMeaningfulCommunication(latestMessage) ? latestMessage : c.latestMeaningfulMessage,
            lastMessageAt: latestMessage.sentAt,
            venueUnread: 0,
          }
        : c
    )));
    setNeedsResponseOverrides((prev) => ({ ...prev, [conversationId]: needsResponse }));
  }

  function clearAllFilters() {
    setFilters(defaultInboxFilters());
    setSearch("");
    setSearchDebounced("");
    setEventSearch("");
    setEventSearchResults([]);
    setSelectedEventLabel(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-medium text-heading">Inbox</h1>
          <p className="text-[0.95rem] text-muted-foreground">
            Email, text, and portal conversations in one place.
          </p>
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {totalUnread > 0 ? `${totalUnread} unread` : "No unread"}
            {" · "}
            {needsResponseCount > 0 ? `${needsResponseCount} need response (this page)` : "None need response on this page"}
          </p>
        </div>
        <Link href="/messaging/health" className="shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline">
          Communication Health →
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or event…"
            aria-label="Search inbox conversations"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs ${
            filtersOpen || !inboxFiltersAreDefault(filters)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          <Filter className="h-3.5 w-3.5" /> Filters
          {!inboxFiltersAreDefault(filters) && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilters((prev) => clearInboxChip(prev, chip.id))}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-foreground"
            >
              {chip.label}
              <X className="h-3 w-3 text-muted-foreground" aria-hidden />
              <span className="sr-only">Remove {chip.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {filtersOpen && (
        <div className="max-h-[min(40vh,22rem)] shrink-0 space-y-4 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-4">
          {/* Top row: compact peer filters — equal weight, no empty cells */}
          <div className="grid gap-4 sm:grid-cols-3">
            <fieldset className="space-y-2">
              <legend className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Attention</legend>
              <div className="flex flex-col gap-1.5 text-xs">
                {([
                  ["all", "All"],
                  ["unread", "Unread"],
                  ["needs_response", "Needs response"],
                ] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="radio"
                      name="inbox-attention"
                      checked={filters.attention === value}
                      onChange={() => setFilters((f) => ({ ...f, attention: value }))}
                      className="h-3.5 w-3.5"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Relationship</legend>
              <select
                aria-label="Filter by lead or booking"
                value={filters.relationship}
                onChange={(e) => setFilters((f) => ({ ...f, relationship: e.target.value as InboxFilterState["relationship"] }))}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="all">All</option>
                <option value="leads">Leads</option>
                <option value="bookings">Bookings</option>
              </select>
              <select
                aria-label="Filter by booking stage"
                value={filters.bookingStage}
                onChange={(e) => setFilters((f) => ({ ...f, bookingStage: e.target.value }))}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value={INBOX_FILTER_ALL}>Any stage</option>
                <option value="package">Package</option>
                <option value="agreement">Agreement</option>
                <option value="deposit">Deposit</option>
                <option value="booked">Booked</option>
                <option value="planning">Planning</option>
              </select>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Channel</legend>
              <select
                aria-label="Filter by channel"
                value={filters.channel}
                onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value={INBOX_FILTER_ALL}>Any channel</option>
                <option value="email">Email</option>
                <option value="sms">Text</option>
                <option value="portal">Portal</option>
                <option value="internal_note">Internal note</option>
              </select>
            </fieldset>
          </div>

          {/* Event: full width — type list ~half, date/status/lookup stacked on the other half */}
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Event</legend>
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">Event type</p>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-background px-2 py-1.5 sm:max-h-52">
                  {INBOX_EVENT_TYPE_OPTIONS.map((t) => {
                    const checked = filters.eventTypes.includes(t.value);
                    return (
                      <label key={t.value} className="flex items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setFilters((f) => toggleInboxEventType(f, t.value))}
                          className="h-3.5 w-3.5"
                          aria-label={`Event type ${t.label}`}
                        />
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0 space-y-2">
                <label className="block space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Event date</span>
                  <select
                    aria-label="Filter by event date"
                    value={filters.eventDatePreset}
                    onChange={(e) => {
                      const preset = e.target.value as InboxEventDatePreset;
                      setFilters((f) => ({
                        ...f,
                        eventDatePreset: preset,
                        ...(preset !== "custom" ? { eventDateFrom: "", eventDateTo: "" } : {}),
                      }));
                    }}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                  >
                    {INBOX_EVENT_DATE_PRESET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                {filters.eventDatePreset === "custom" && (
                  <div className="flex gap-2">
                    <label className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">From</span>
                      <input
                        type="date"
                        aria-label="Custom event date from"
                        value={filters.eventDateFrom}
                        onChange={(e) => setFilters((f) => ({ ...f, eventDateFrom: e.target.value }))}
                        className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                      />
                    </label>
                    <label className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">To</span>
                      <input
                        type="date"
                        aria-label="Custom event date to"
                        value={filters.eventDateTo}
                        onChange={(e) => setFilters((f) => ({ ...f, eventDateTo: e.target.value }))}
                        className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                      />
                    </label>
                  </div>
                )}

                <label className="block space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Event status</span>
                  <select
                    aria-label="Filter by event status"
                    value={filters.eventStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, eventStatus: e.target.value }))}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                  >
                    <option value={INBOX_FILTER_ALL}>Any status</option>
                    <option value="draft">Draft</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In progress</option>
                    <option value="complete">Complete</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>

                <div className="space-y-1 border-t border-border/60 pt-2">
                  <p className="text-[10px] text-muted-foreground">Specific event</p>
                  {filters.eventId !== INBOX_FILTER_ALL && selectedEventLabel ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{selectedEventLabel}</span>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] font-medium text-primary hover:underline"
                        onClick={() => {
                          setFilters((f) => ({ ...f, eventId: INBOX_FILTER_ALL }));
                          setEventSearch("");
                          setEventSearchResults([]);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="search"
                        aria-label="Search for a specific event"
                        placeholder="Search by event name…"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                      />
                      {eventSearch.trim().length >= 2 && (
                        <div className="max-h-28 overflow-y-auto rounded-lg border border-border bg-background">
                          {eventSearchPending ? (
                            <p className="px-2 py-1.5 text-[10px] text-muted-foreground">Searching…</p>
                          ) : eventSearchResults.length === 0 ? (
                            <p className="px-2 py-1.5 text-[10px] text-muted-foreground">No matching events</p>
                          ) : (
                            eventSearchResults.map((ev) => (
                              <button
                                key={ev.id}
                                type="button"
                                className="block w-full truncate px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                                onClick={() => {
                                  setFilters((f) => ({ ...f, eventId: ev.id }));
                                  setEventSearch("");
                                  setEventSearchResults([]);
                                  const date = ev.eventDate
                                    ? new Date(`${ev.eventDate}T12:00:00`).toLocaleDateString("en-US", {
                                        month: "short", day: "numeric", year: "numeric",
                                      })
                                    : null;
                                  setSelectedEventLabel(date ? `${ev.name} · ${date}` : ev.name);
                                }}
                              >
                                {ev.name}{ev.eventDate ? ` · ${ev.eventDate}` : ""}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </fieldset>

          {/* Bottom row: remaining filters share the width evenly */}
          <div className="grid gap-4 sm:grid-cols-3">
            <fieldset className="space-y-2">
              <legend className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assignment</legend>
              <select
                aria-label="Filter by assignment"
                value={
                  filters.assignment.mode === "staff"
                    ? filters.assignment.staffId
                    : filters.assignment.mode
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "any" || v === "unassigned" || v === "me") {
                    setFilters((f) => ({ ...f, assignment: { mode: v } }));
                  } else {
                    setFilters((f) => ({ ...f, assignment: { mode: "staff", staffId: v } }));
                  }
                }}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="any">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Attachments</legend>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={filters.hasAttachments}
                  onChange={(e) => setFilters((f) => ({ ...f, hasAttachments: e.target.checked }))}
                  className="h-3.5 w-3.5"
                />
                Has attachments
              </label>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sort</legend>
              <select
                aria-label="Sort conversations"
                value={filters.sort}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as InboxSort }))}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
              >
                {INBOX_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </fieldset>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-sm border border-border bg-card">
        <div className={`w-full shrink-0 overflow-y-auto border-r border-border/60 md:w-80 lg:w-96 ${activeId ? "hidden md:block" : ""}`}>
          {loading ? (
            <p className="p-4 text-xs text-muted-foreground">Loading…</p>
          ) : loadError ? (
            <div className="space-y-2 p-4">
              <p className="text-sm font-medium text-heading">{loadError}</p>
              <button type="button" onClick={() => void loadPage("replace")} className="text-xs font-medium text-primary hover:underline">
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="space-y-2 p-4">
              {hasActiveFilters ? (
                <>
                  <p className="text-sm font-medium text-heading">No matching conversations</p>
                  <p className="text-xs text-muted-foreground">
                    Nothing matches this search or filter. Clear them to see more.
                  </p>
                  <button type="button" onClick={clearAllFilters} className="text-xs font-medium text-primary hover:underline">
                    Clear search and filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-heading">No conversations yet</p>
                  <p className="text-xs text-muted-foreground">
                    When someone emails, texts, or messages through the portal, it will show up here.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {items.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  isActive={c.id === activeId}
                  needsResponse={needsResponseForRow(c, needsResponseOverrides)}
                  timeLabel={formatListTime(c.lastMessageAt, nowMs)}
                  onClick={() => setActiveId(c.id)}
                />
              ))}
              {hasMore && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadPage("append")}
                  className="w-full px-4 py-3 text-center text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </div>

        <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${activeId ? "" : "hidden md:flex md:items-center md:justify-center"}`}>
          {activeId ? (
            <ConversationThread
              key={activeId}
              conversationId={activeId}
              onBack={() => setActiveId(null)}
              summary={activeSummary ?? undefined}
              teamMembers={teamMembers}
              onInboxOpened={(needsResponse) => markConversationOpened(activeId, needsResponse)}
              onInboxSent={(latestMessage, needsResponse) => {
                markConversationSent(activeId, latestMessage, needsResponse);
              }}
            />
          ) : (
            <div className="max-w-xs space-y-1 px-6 text-center">
              <p className="text-sm font-medium text-heading">Select a conversation</p>
              <p className="text-xs text-muted-foreground">
                Choose someone from the list to read and reply by email or text.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * ConversationInbox — Pass 2 multi-channel communication workspace.
 * Three zones: list · thread · context (drawer below lg).
 * Server-side pagination; progressive filters; unambiguous event cues only.
 */

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Filter, PanelRight, Paperclip, Search } from "lucide-react";

import { getConversationInboxPageAction } from "@/app/(app)/messaging/actions";
import { CHANNEL_META, ConversationThread } from "@/components/conversations/conversation-thread";
import {
  RelationshipContextPanel,
  RelationshipContextSheet,
} from "@/components/conversations/relationship-context-panel";
import {
  conversationNeedsResponseFromSummary,
  isMeaningfulCommunication,
} from "@/lib/conversations/inbox-attention";
import type { ConversationMessagePreview, ConversationSummary } from "@/lib/conversations/types";
import type { StaffMember } from "@/lib/team/types";

const ALL = "__all__";
type RelationshipFilter = "all" | "leads" | "bookings";

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

function formatEventCue(c: ConversationSummary): string | null {
  if (c.eventCount !== 1 || !c.eventDate) return null;
  const d = new Date(`${c.eventDate}T12:00:00`);
  const dateLabel = Number.isNaN(d.getTime())
    ? c.eventDate
    : d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const type = c.eventType ? ` ${c.eventType}` : c.eventName ? ` ${c.eventName}` : "";
  // Prefer "October 18 Wedding" style when type is short; fall back to event name.
  if (c.eventType) return `${dateLabel} ${c.eventType}`;
  if (c.eventName) return `${dateLabel} · ${c.eventName}`;
  return dateLabel + type;
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
  const eventCue = formatEventCue(conversation);

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

export function ConversationInbox({ teamMembers = [] }: { teamMembers?: StaffMember[] }) {
  const searchParams = useSearchParams();
  const [items, setItems] = React.useState<ConversationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<{ lastMessageAt: string | null; id: string } | null>(null);
  const [totalUnread, setTotalUnread] = React.useState(0);
  const [needsResponseOverrides, setNeedsResponseOverrides] = React.useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = React.useState<string | null>(() => searchParams.get("conversation"));
  const [nowMs, setNowMs] = React.useState<number | null>(null);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const [searchDebounced, setSearchDebounced] = React.useState("");
  const [relationshipFilter, setRelationshipFilter] = React.useState<RelationshipFilter>("all");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [needsResponseOnly, setNeedsResponseOnly] = React.useState(false);
  const [channelFilter, setChannelFilter] = React.useState(ALL);
  const [bookingStageFilter, setBookingStageFilter] = React.useState(ALL);
  const [assignedFilter, setAssignedFilter] = React.useState(ALL);

  React.useEffect(() => {
    setNowMs(Date.now());
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = React.useMemo(() => JSON.stringify({
    searchDebounced, relationshipFilter, unreadOnly, needsResponseOnly,
    channelFilter, bookingStageFilter, assignedFilter,
  }), [
    searchDebounced, relationshipFilter, unreadOnly, needsResponseOnly,
    channelFilter, bookingStageFilter, assignedFilter,
  ]);

  const loadPage = React.useCallback(async (mode: "replace" | "append") => {
    if (mode === "replace") setLoading(true);
    else setLoadingMore(true);
    const page = await getConversationInboxPageAction({
      limit: 40,
      cursorLastMessageAt: mode === "append" ? nextCursor?.lastMessageAt : null,
      cursorId: mode === "append" ? nextCursor?.id : null,
      search: searchDebounced || null,
      unreadOnly,
      needsResponseOnly,
      relationship: relationshipFilter,
      channel: channelFilter === ALL ? null : channelFilter,
      bookingStage: bookingStageFilter === ALL ? null : bookingStageFilter,
      assignedStaffId: assignedFilter === ALL ? null : assignedFilter,
    });
    setItems((prev) => (mode === "append" ? [...prev, ...page.conversations] : page.conversations));
    setHasMore(page.hasMore);
    setNextCursor(page.nextCursor);
    setTotalUnread(page.totalUnread);
    if (mode === "replace") setNeedsResponseOverrides({});
    setLoading(false);
    setLoadingMore(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nextCursor only for append; replace ignores it
  }, [
    searchDebounced, unreadOnly, needsResponseOnly, relationshipFilter,
    channelFilter, bookingStageFilter, assignedFilter, nextCursor,
  ]);

  React.useEffect(() => {
    setNextCursor(null);
    void (async () => {
      setLoading(true);
      const page = await getConversationInboxPageAction({
        limit: 40,
        search: searchDebounced || null,
        unreadOnly,
        needsResponseOnly,
        relationship: relationshipFilter,
        channel: channelFilter === ALL ? null : channelFilter,
        bookingStage: bookingStageFilter === ALL ? null : bookingStageFilter,
        assignedStaffId: assignedFilter === ALL ? null : assignedFilter,
      });
      setItems(page.conversations);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setTotalUnread(page.totalUnread);
      setNeedsResponseOverrides({});
      setLoading(false);
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

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
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

      <div className="flex flex-wrap items-center gap-2">
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
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs ${
            filtersOpen ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
          }`}
        >
          <Filter className="h-3.5 w-3.5" /> Filters
        </button>
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Attention</p>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="h-3.5 w-3.5" />
                Unread
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={needsResponseOnly} onChange={(e) => setNeedsResponseOnly(e.target.checked)} className="h-3.5 w-3.5" />
                Needs response
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Relationship</p>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filter by lead or booking"
                value={relationshipFilter}
                onChange={(e) => setRelationshipFilter(e.target.value as RelationshipFilter)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="all">All</option>
                <option value="leads">Leads</option>
                <option value="bookings">Clients</option>
              </select>
              <select
                aria-label="Filter by booking stage"
                value={bookingStageFilter}
                onChange={(e) => setBookingStageFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value={ALL}>Any stage</option>
                <option value="package">Package</option>
                <option value="agreement">Agreement</option>
                <option value="deposit">Deposit</option>
                <option value="booked">Booked</option>
                <option value="planning">Planning</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Communication</p>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filter by channel"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value={ALL}>Any channel</option>
                <option value="email">Email</option>
                <option value="sms">Text</option>
                <option value="portal">Portal</option>
              </select>
              <select
                aria-label="Filter by assigned coordinator"
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value={ALL}>Anyone</option>
                {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100svh-9rem)] min-h-[28rem] overflow-hidden rounded-sm border border-border bg-card">
        <div className="flex h-full w-full min-h-0">
          <div className={`w-full shrink-0 overflow-y-auto border-r border-border/60 md:w-80 ${activeId ? "hidden md:block" : ""}`}>
            {loading ? (
              <p className="p-4 text-xs text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <div className="space-y-1 p-4">
                <p className="text-sm font-medium text-heading">No conversations match</p>
                <p className="text-xs text-muted-foreground">Try clearing search or filters.</p>
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
                    onClick={() => { setActiveId(c.id); setContextOpen(false); }}
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

          <div className={`flex min-h-0 min-w-0 flex-1 ${activeId ? "" : "hidden md:flex md:items-center md:justify-center"}`}>
            {activeId ? (
              <>
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-end gap-2 border-b border-border/40 px-3 py-1.5 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setContextOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      <PanelRight className="h-3.5 w-3.5" /> Context
                    </button>
                  </div>
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
                </div>
                <RelationshipContextPanel
                  key={`ctx-${activeId}`}
                  conversationId={activeId}
                  leadId={activeSummary?.leadId ?? null}
                  clientId={activeSummary?.clientId ?? null}
                />
                <RelationshipContextSheet
                  open={contextOpen}
                  onClose={() => setContextOpen(false)}
                  conversationId={activeId}
                  leadId={activeSummary?.leadId ?? null}
                  clientId={activeSummary?.clientId ?? null}
                />
              </>
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
    </div>
  );
}

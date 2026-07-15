"use client";

/**
 * ConversationInbox — Program 2 Phase 2B, completed in the Communication
 * Workspace Completion task.
 *
 * The unified replacement for the legacy two-surface messaging experience
 * (portal-chat-only nav inbox + email-only per-record tab). One list, one
 * thread per Relationship, every channel merged and tagged rather than
 * siloed — per docs/conversation-experience-cutover.md's guiding principle:
 * a venue should never have to wonder where a conversation happened.
 *
 * The thread view itself lives in components/conversations/conversation-thread.tsx
 * — shared with the Lead/Client detail page's Conversation tab, so opening a
 * conversation from either place is byte-for-byte the same experience.
 *
 * Flag-gated: only rendered when the current venue has
 * conversationExperienceEnabled = true (see page.tsx). No attachments this
 * phase, by explicit agreement (Program 2 Phase 3/4 territory).
 */

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { getConversationInboxAction, getScheduledCountForTodayAction } from "@/app/(app)/messaging/actions";
import { CHANNEL_META, ConversationThread } from "@/components/conversations/conversation-thread";
import type { ConversationSummary } from "@/lib/conversations/types";
import type { StaffMember } from "@/lib/team/types";

const ALL = "__all__";
type RelationshipFilter = "all" | "leads" | "bookings";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(/[\s&]+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-2xl font-semibold text-heading">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ConversationRow({
  conversation, isActive, onClick,
}: { conversation: ConversationSummary; isActive: boolean; onClick: () => void }) {
  const preview = conversation.latestMessage;
  const previewText = preview
    ? `${preview.senderType === "venue_staff" ? "You: " : ""}${preview.body}`
    : "No messages yet";
  const ChannelIcon = preview ? CHANNEL_META[preview.channel]?.icon : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-border/40 transition-colors hover:bg-muted/30 ${isActive ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
    >
      <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
        <span className="text-xs font-semibold text-primary">{initials(conversation.displayName)}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium truncate ${conversation.venueUnread > 0 ? "text-heading" : "text-foreground"}`}>
            {conversation.displayName ?? "Unnamed relationship"}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conversation.lastMessageAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium">{conversation.clientId ? "Booking" : "Lead"}</span>
          {ChannelIcon && <ChannelIcon className="h-3 w-3" />}
          {conversation.assignedStaffName && <span className="truncate">· {conversation.assignedStaffName}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs truncate ${conversation.venueUnread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {previewText}
          </p>
          {conversation.venueUnread > 0 && (
            <span className="shrink-0 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {conversation.venueUnread > 9 ? "9+" : conversation.venueUnread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function ConversationInbox({ teamMembers = [] }: { teamMembers?: StaffMember[] }) {
  const [items, setItems] = React.useState<ConversationSummary[] | null>(null);
  const [totalUnread, setTotalUnread] = React.useState(0);
  const [scheduledToday, setScheduledToday] = React.useState(0);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [relationshipFilter, setRelationshipFilter] = React.useState<RelationshipFilter>("all");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [assignedFilter, setAssignedFilter] = React.useState(ALL);

  React.useEffect(() => {
    void getConversationInboxAction().then((r) => { setItems(r.conversations); setTotalUnread(r.totalUnread); });
    void getScheduledCountForTodayAction().then(setScheduledToday);
  }, []);

  const filtered = React.useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (relationshipFilter === "leads" && c.clientId) return false;
      if (relationshipFilter === "bookings" && !c.clientId) return false;
      if (unreadOnly && c.venueUnread === 0) return false;
      if (assignedFilter !== ALL && c.assignedStaffId !== assignedFilter) return false;
      if (q && !(c.displayName ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, relationshipFilter, unreadOnly, assignedFilter, search]);

  // Waiting for Client / Waiting for Venue — computed from who sent the last
  // message, never a stored status (conversations has none, by design).
  const waitingForClient = (items ?? []).filter((c) =>
    c.latestMessage && (c.latestMessage.senderType === "venue_staff" || c.latestMessage.senderType === "system")).length;
  const waitingForVenue = (items ?? []).filter((c) =>
    c.latestMessage && c.latestMessage.senderType !== "venue_staff" && c.latestMessage.senderType !== "system").length;

  const activeSummary = items?.find((c) => c.id === activeId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-heading">Inbox</h1>
          <p className="text-sm text-muted-foreground">Every conversation with a lead or booked client, in one place.</p>
        </div>
        <Link href="/messaging/health" className="shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline">
          Communication Health →
        </Link>
      </div>

      {/* Communication Dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Unread" value={totalUnread} />
        <StatTile label="Waiting for Client" value={waitingForClient} />
        <StatTile label="Waiting for Venue" value={waitingForVenue} />
        <StatTile label="Scheduled Today" value={scheduledToday} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…" aria-label="Search conversations"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <select
          aria-label="Filter by lead or booking" value={relationshipFilter}
          onChange={(e) => setRelationshipFilter(e.target.value as RelationshipFilter)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
        >
          <option value="all">All</option>
          <option value="leads">Leads</option>
          <option value="bookings">Bookings</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="h-3.5 w-3.5" />
          Unread only
        </label>
        <select
          aria-label="Filter by assigned coordinator" value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
        >
          <option value={ALL}>Anyone</option>
          {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: "calc(100vh - 320px)" }}>
        <div className="flex h-full">
          <div className={`w-full md:w-80 shrink-0 border-r border-border/60 overflow-y-auto ${activeId ? "hidden md:block" : ""}`}>
            {items === null ? (
              <p className="p-4 text-xs text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">
                {items.length === 0 ? "No conversations yet." : "No conversations match your filters."}
              </p>
            ) : (
              filtered.map((c) => (
                <ConversationRow key={c.id} conversation={c} isActive={c.id === activeId} onClick={() => setActiveId(c.id)} />
              ))
            )}
          </div>
          <div className={`flex-1 ${activeId ? "" : "hidden md:flex md:items-center md:justify-center"}`}>
            {activeId ? (
              <ConversationThread
                key={activeId}
                conversationId={activeId} onBack={() => setActiveId(null)}
                summary={activeSummary} teamMembers={teamMembers}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a conversation</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";

import type { VendorConversationSummary } from "@/lib/conversations/types";

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

function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function counterpartySubtitle(c: VendorConversationSummary): string {
  if (c.counterpartyLabel === "Couple") {
    return c.coupleName?.trim() ? `Couple · ${c.coupleName}` : "Couple";
  }
  return c.venueName?.trim() ? `Venue · ${c.venueName}` : "Venue";
}

function InboxRow({ c }: { c: VendorConversationSummary }) {
  return (
    <Link
      href={`/vendor/messages/${c.conversationId}`}
      className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${c.contactUnread > 0 ? "font-semibold text-heading" : "font-medium text-foreground"}`}>
            {c.eventName}
            <span className="ml-1.5 font-normal text-muted-foreground">· {c.counterpartyLabel}</span>
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.lastMessageAt)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{counterpartySubtitle(c)}</p>
        <p className={`text-xs truncate ${c.contactUnread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
          {c.latestMessage
            ? `${c.latestMessage.senderType === "vendor" ? "You: " : ""}${c.latestMessage.body}`
            : c.eventDate ? formatEventDate(c.eventDate) : "No messages yet"}
        </p>
      </div>
      {c.contactUnread > 0 && (
        <span className="shrink-0 h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
          {c.contactUnread > 9 ? "9+" : c.contactUnread}
        </span>
      )}
    </Link>
  );
}

export function VendorMessagesInbox({ conversations }: { conversations: VendorConversationSummary[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Separate threads with the venue and the couple for each event you&apos;re booked for.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border py-14 text-center">
          <p className="text-sm font-medium text-foreground">No conversations yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            When a venue assigns you to an event, Venue and Couple conversations appear here.
          </p>
        </div>
      ) : conversations.every((c) => c.contactUnread === 0) ? (
        <>
          <div className="rounded-sm border border-dashed border-border py-6 text-center">
            <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground mt-1">No messages need a reply right now.</p>
          </div>
          <div className="rounded-sm border border-border bg-card divide-y divide-border overflow-hidden">
            {conversations.map((c) => (
              <InboxRow key={c.conversationId} c={c} />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-sm border border-border bg-card divide-y divide-border overflow-hidden">
          {conversations.map((c) => (
            <InboxRow key={c.conversationId} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

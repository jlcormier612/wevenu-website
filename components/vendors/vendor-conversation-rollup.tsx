import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VendorRollupConversation } from "@/lib/conversations/types";

/**
 * RC2, Milestone 3 — "every conversation we've ever had with this vendor,
 * across every event." A derived rollup, not a second messaging system: each
 * row is a real, independent event-anchored Conversation — Photography for
 * Emma & James is a different operational thread than Photography for Sarah
 * & Mike. Clicking through opens that event's own Vendors tab, where the
 * actual thread lives (components/events/vendors/event-vendors-section.tsx).
 */
function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function VendorConversationRollup({ conversations }: { conversations: VendorRollupConversation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversations</CardTitle>
        <CardDescription>Every conversation with this vendor, one per event.</CardDescription>
      </CardHeader>
      <CardContent>
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conversations with this vendor yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((c) => (
              <Link
                key={c.conversationId}
                href={`/events/${c.eventId}?conversation=${c.conversationId}#vendors`}
                className="flex items-start gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{c.eventName}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {c.latestMessage
                        ? `${c.latestMessage.senderType === "vendor" ? "" : "You: "}${c.latestMessage.body}`
                        : c.eventDate ? formatEventDate(c.eventDate) : "No messages yet"}
                    </p>
                    {c.venueUnread > 0 && (
                      <span className="shrink-0 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {c.venueUnread > 9 ? "9+" : c.venueUnread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

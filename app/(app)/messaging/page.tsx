import type { Metadata } from "next";

import Link from "next/link";
import { Mail, MessageSquare } from "lucide-react";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { getThreads } from "@/lib/messaging/service";

export const metadata: Metadata = { title: "Messaging" };

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function MessagingPage() {
  const threads = await getThreads();

  function entityLink(t: (typeof threads)[0]) {
    return t.leadId   ? `/leads/${t.leadId}`
         : t.clientId ? `/clients/${t.clientId}`
         : t.eventId  ? `/events/${t.eventId}`
         : "/messaging";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messaging"
        description="All communications with your leads and clients in one place."
      />

      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-heading">No messages yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Messages sent from Lead or Client records appear here. Open a lead and click the "Messages" tab to start a conversation.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {threads.map((thread) => (
            <Link key={thread.id} href={entityLink(thread)}
              className="flex items-start gap-4 rounded-xl border border-border bg-card px-4 py-3.5 hover:bg-muted/30 transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-heading">{thread.entityName ?? "Unknown"}</p>
                  <Badge variant="muted" className="text-[10px]">{thread.channel}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {thread.subject && <span className="font-medium text-foreground">{thread.subject} · </span>}
                  {thread.lastMessagePreview ?? "No messages"}
                </p>
              </div>
              <div className="shrink-0 text-right space-y-0.5">
                <p className="text-xs text-muted-foreground">{timeAgo(thread.lastMessageAt)}</p>
                <p className="text-[10px] text-muted-foreground">{thread.messageCount} msg{thread.messageCount !== 1 ? "s" : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

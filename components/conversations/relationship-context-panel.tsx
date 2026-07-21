"use client";

/**
 * RelationshipContextPanel — RC2, Milestone 1, upgraded in Milestone 4.
 *
 * "Conversation as the relationship's paper folder, not just chat." Shown
 * alongside the thread (never instead of it): linked Requests, the files
 * shared in this conversation, and a recent-activity strip. No new
 * tables — a composed read over data that already exists. The activity
 * strip now sources from the full Activity Timeline (capped to a
 * handful) — "View full activity" opens the uncapped audit trail on the
 * relationship's own Activity tab.
 */

import * as React from "react";
import Link from "next/link";
import { ClipboardList, FileText, History } from "lucide-react";

import { getConversationAttachmentsAction, getRelationshipContextAction } from "@/app/(app)/messaging/actions";
import type { RelationshipContext } from "@/lib/conversations/context";

type Attachment = { id: string; fileUrl: string; fileName: string; fileSize: number | null; mimeType: string | null; sentAt: string };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {title}
      </div>
      {children}
    </div>
  );
}

export function RelationshipContextPanel({
  conversationId, leadId, clientId,
}: {
  conversationId: string;
  leadId: string | null;
  clientId: string | null;
}) {
  const [context, setContext] = React.useState<RelationshipContext | null>(null);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);

  React.useEffect(() => {
    void getRelationshipContextAction(leadId, clientId).then(setContext);
    void getConversationAttachmentsAction(conversationId).then(setAttachments);
  }, [conversationId, leadId, clientId]);

  const requestHref = clientId ? `/clients/${clientId}` : leadId ? `/leads/${leadId}` : null;

  return (
    <div className="hidden lg:block w-64 shrink-0 border-l border-border/60 overflow-y-auto p-4 space-y-5">
      <Section icon={ClipboardList} title="Requests">
        {!context ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : context.requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">No open requests.</p>
        ) : (
          <div className="space-y-1.5">
            {context.requests.map((r) => (
              <Link key={r.id} href={requestHref ? `${requestHref}#requests` : "#"} className="block rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:bg-muted/40">
                <p className="truncate font-medium text-heading">{r.title}</p>
                <p className="text-[10px] text-muted-foreground">{r.status.replace(/_/g, " ")}</p>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section icon={FileText} title="Files">
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No files shared yet.</p>
        ) : (
          <div className="space-y-1.5">
            {attachments.map((a) => (
              <a key={a.id} href={a.fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:bg-muted/40">
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.fileName}</span>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section icon={History} title="Recent activity">
        {!context ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : context.recentActivity.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="space-y-2">
            {context.recentActivity.map((a) => (
              <div key={`${a.type}-${a.occurredAt}`} className="text-xs">
                <p className="text-heading">{a.title}</p>
                <p className="text-[10px] text-muted-foreground">{timeAgo(a.occurredAt)}</p>
              </div>
            ))}
            {requestHref && (
              <Link href={`${requestHref}#activity`} className="block pt-1 text-[10px] font-medium text-primary hover:underline">
                View full activity →
              </Link>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

"use client";

/**
 * RelationshipContextPanel — Inbox Pass 2 orientation + supporting context.
 * Same model powers the desktop pane and the responsive drawer/sheet.
 */

import * as React from "react";
import Link from "next/link";
import { ClipboardList, FileText, History, X } from "lucide-react";

import { getConversationAttachmentsAction, getRelationshipContextAction } from "@/app/(app)/messaging/actions";
import type { RelationshipContext } from "@/lib/conversations/context";
import { documentsWorkspaceHref } from "@/lib/conversations/attachment-document";

type Attachment = {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  sentAt: string;
  channel?: string | null;
  senderLabel?: string | null;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function ContextBody({
  conversationId, leadId, clientId, onClose,
}: {
  conversationId: string;
  leadId: string | null;
  clientId: string | null;
  onClose?: () => void;
}) {
  const [context, setContext] = React.useState<RelationshipContext | null>(null);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);

  React.useEffect(() => {
    void getRelationshipContextAction(leadId, clientId).then(setContext);
    void getConversationAttachmentsAction(conversationId).then((rows) => {
      setAttachments(rows as Attachment[]);
    });
  }, [conversationId, leadId, clientId]);

  const requestHref = clientId ? `/clients/${clientId}` : leadId ? `/leads/${leadId}` : null;
  const docsHref = documentsWorkspaceHref({ leadId, clientId });
  const o = context?.orientation;

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-heading">
            {o?.displayName ?? "Relationship"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {o?.relationshipType ?? "…"}
            {o?.bookingStageLabel ? ` · ${o.bookingStageLabel}` : ""}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Close context">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {o && (
        <Section title="Orientation">
          <div className="space-y-1.5 text-xs text-heading">
            {o.relationshipType === "Lead" && o.preferredDate && (
              <p><span className="text-muted-foreground">Preferred date · </span>{o.preferredDate}</p>
            )}
            {o.relationshipType === "Lead" && o.leadEventType && (
              <p><span className="text-muted-foreground">Event type · </span>{o.leadEventType}</p>
            )}
            {o.eventUnambiguous && o.eventName && (
              <p>
                <span className="text-muted-foreground">Event · </span>
                {o.eventName}
                {o.eventDate ? ` · ${o.eventDate}` : ""}
                {o.eventType ? ` · ${o.eventType}` : ""}
              </p>
            )}
            {o.packageSummary && (
              <p><span className="text-muted-foreground">Package · </span>{o.packageSummary}</p>
            )}
            {o.financialFact && (
              <p>
                <span className="text-muted-foreground">Payments · </span>{o.financialFact}
                {o.financialHref && (
                  <>
                    {" · "}
                    <Link href={o.financialHref} className="font-medium text-primary hover:underline">Open payments</Link>
                  </>
                )}
              </p>
            )}
            {requestHref && (
              <Link href={requestHref} className="inline-block pt-1 text-[11px] font-medium text-primary hover:underline">
                Open {o.relationshipType === "Booking" ? "booking" : "lead"} workspace →
              </Link>
            )}
          </div>
        </Section>
      )}

      <Section title="Requests">
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

      <Section title="Files">
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No files shared in this conversation yet.</p>
        ) : (
          <div className="space-y-1.5">
            {attachments.map((a) => (
              <div key={a.id} className="rounded-lg border border-border/60 px-2.5 py-1.5 text-xs">
                <a href={a.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:bg-muted/40">
                  <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{a.fileName}</span>
                </a>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Shared in conversation{a.channel === "sms" ? " · SMS" : a.channel === "email" ? " · Email" : ""}
                </p>
                {docsHref && (
                  <Link href={docsHref} className="mt-1 block text-[10px] font-medium text-primary hover:underline">
                    View in Documents →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent activity">
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

export function RelationshipContextPanel({
  conversationId, leadId, clientId,
}: {
  conversationId: string;
  leadId: string | null;
  clientId: string | null;
}) {
  return (
    <div className="hidden h-full w-72 shrink-0 overflow-y-auto border-l border-border/60 lg:block">
      <ContextBody conversationId={conversationId} leadId={leadId} clientId={clientId} />
    </div>
  );
}

/** Same context model as the desktop pane — used below lg as a sheet/drawer. */
export function RelationshipContextSheet({
  open, onClose, conversationId, leadId, clientId,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  leadId: string | null;
  clientId: string | null;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Dismiss" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          <History className="h-3.5 w-3.5" />
          Relationship context
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ContextBody conversationId={conversationId} leadId={leadId} clientId={clientId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

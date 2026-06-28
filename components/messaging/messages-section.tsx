"use client";

/**
 * MessagesSection — the "Messages" tab on Lead and Client detail pages.
 *
 * Shows all message threads for the entity. Each thread expands to show
 * individual messages. "New Message" opens the compose form inline.
 */

import * as React from "react";

import { ArrowUpRight, ChevronDown, ChevronRight, Mail, Plus } from "lucide-react";
import { toast } from "sonner";

import { sendMessageAction } from "@/app/(app)/messaging/actions";
import { MessageCompose } from "@/components/messaging/message-compose";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ComposeInput, Message, MessageEntityType, SendResult, ThreadWithMessages } from "@/lib/messaging/types";

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";
  const time = new Date(message.createdAt).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  return (
    <div className={`flex flex-col gap-1 ${isOutbound ? "items-end" : "items-start"}`}>
      <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
        isOutbound
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground border border-border"
      }`}>
        {message.subject && (
          <p className={`text-xs font-semibold mb-1 ${isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {message.subject}
          </p>
        )}
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>{isOutbound ? "You" : (message.fromName ?? "Contact")}</span>
        <span>·</span>
        <span>{time}</span>
        {message.status === "failed" && <span className="text-destructive font-medium">· Failed</span>}
        {message.status === "sent" && isOutbound && <span>· Sent</span>}
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  defaultEmail,
  entityType,
  entityId,
}: {
  thread: ThreadWithMessages;
  defaultEmail: string;
  entityType: MessageEntityType;
  entityId: string;
}) {
  const [expanded, setExpanded] = React.useState(thread.messages.length > 0 && thread.messageCount <= 3);
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [messages, setMessages] = React.useState(thread.messages);

  function handleSent(result: SendResult) {
    setReplyOpen(false);
    // Router.refresh() will re-fetch with server action revalidation
  }

  const lastMsg = messages[messages.length - 1];
  const time = thread.lastMessageAt
    ? new Date(thread.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Thread header */}
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-heading truncate">{thread.subject ?? "No subject"}</p>
          {lastMsg && (
            <p className="text-xs text-muted-foreground truncate">{lastMsg.body.slice(0, 60)}{lastMsg.body.length > 60 ? "…" : ""}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{time}</span>
          <span className="text-xs text-muted-foreground rounded-full bg-muted px-1.5 py-0.5">{messages.length}</span>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded thread */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          <div className="space-y-4">
            {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
          </div>
          {!replyOpen && (
            <Button type="button" variant="outline" size="sm" onClick={() => setReplyOpen(true)} className="mt-2">
              <ArrowUpRight className="mr-1 h-3.5 w-3.5" /> Reply
            </Button>
          )}
          {replyOpen && (
            <MessageCompose
              entityType={entityType}
              entityId={entityId}
              defaultToEmail={lastMsg?.toEmail ?? defaultEmail}
              defaultToName={thread.entityName ?? ""}
              prefillSubject={thread.subject ? `Re: ${thread.subject}` : ""}
              onSent={handleSent}
              onCancel={() => setReplyOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function MessagesSection({
  entityType,
  entityId,
  entityEmail,
  entityName,
  initialThreads,
  prefillSubject,
  prefillBody,
  onPrefillUsed,
}: {
  entityType: MessageEntityType;
  entityId: string;
  entityEmail: string | null;
  entityName: string;
  initialThreads: ThreadWithMessages[];
  prefillSubject?: string;
  prefillBody?: string;
  onPrefillUsed?: () => void;
}) {
  const [threads, setThreads] = React.useState(initialThreads);
  const [composing, setComposing] = React.useState(!!(prefillSubject || prefillBody));

  // When prefill arrives (from Luv bridge), open compose automatically
  React.useEffect(() => {
    if (prefillSubject || prefillBody) setComposing(true);
  }, [prefillSubject, prefillBody]);

  function handleSent(result: SendResult) {
    setComposing(false);
    // The revalidatePath in the server action will refresh data
    // For optimistic UX, trigger a soft refresh
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      {/* New message button */}
      <div className="flex items-center justify-between">
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Start a conversation below.</p>
        ) : (
          <p className="text-xs text-muted-foreground">{threads.length} thread{threads.length !== 1 ? "s" : ""}</p>
        )}
        {!composing && (
          <Button type="button" size="sm" variant="outline" onClick={() => setComposing(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> New Message
          </Button>
        )}
      </div>

      {/* Compose new message */}
      {composing && (
        <>
          <MessageCompose
            entityType={entityType}
            entityId={entityId}
            defaultToEmail={entityEmail ?? ""}
            defaultToName={entityName}
            prefillSubject={prefillSubject}
            prefillBody={prefillBody}
            onSent={(result) => { onPrefillUsed?.(); handleSent(result); }}
            onCancel={() => { setComposing(false); onPrefillUsed?.(); }}
          />
          {threads.length > 0 && <Separator />}
        </>
      )}

      {/* Thread list */}
      <div className="space-y-2">
        {threads.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            defaultEmail={entityEmail ?? ""}
            entityType={entityType}
            entityId={entityId}
          />
        ))}
      </div>

      {!entityEmail && !composing && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Add an email address to this record to send messages.
        </p>
      )}
    </div>
  );
}

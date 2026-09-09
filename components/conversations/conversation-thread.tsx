"use client";

/**
 * ConversationThread — the message-list-and-compose view shared by every
 * surface that shows a Conversation: the main-nav inbox
 * (app/(app)/messaging/conversation-inbox.tsx) and the Lead/Client detail
 * page's Conversation tab. One implementation, not two — a coordinator
 * should see byte-identical behavior whether they got here from the inbox
 * or from Emma & James' own record, per the "one workspace" guiding
 * principle in docs/conversation-experience-cutover.md.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Bot, Clock, FileText, ListTodo, Mail, MessageSquare, Phone, RotateCcw, Send, Smartphone, StickyNote, User, Voicemail, Workflow, X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelScheduledMessageAction, getActiveEnrollmentsForConversationAction, getConversationAction,
  getRelationshipContextAction, getScheduledForConversationAction, setConversationAssignedStaffAction,
} from "@/app/(app)/messaging/actions";
import {
  addTaskAction,
} from "@/app/(app)/leads/[id]/actions";
import { ConversationCompose } from "@/components/conversations/conversation-compose";
import { MessageTimelinePopover } from "@/components/messaging/message-timeline-popover";
import { documentsWorkspaceHref } from "@/lib/conversations/attachment-document";
import { deliveryRecoveryActions } from "@/lib/conversations/delivery-recovery";
import { resolveDeliveryDisplay } from "@/lib/conversations/delivery-display";
import {
  conversationNeedsResponse,
  latestMeaningfulFromMessages,
} from "@/lib/conversations/inbox-attention";
import { conversationHeaderOrientation } from "@/lib/conversations/inbox-header";
import { SENDABLE_CHANNEL_LABEL } from "@/lib/conversations/channels";
import {
  mergeSentAckIntoMessages,
  type SentMessageAck,
} from "@/lib/conversations/send-ui-state";
import type {
  ConversationChannel,
  ConversationMessage,
  ConversationMessagePreview,
  ConversationSummary,
} from "@/lib/conversations/types";
import type { SequenceEnrollment } from "@/lib/message-sequences/types";
import type { ScheduledMessage } from "@/lib/scheduled-messages/types";
import type { StaffMember } from "@/lib/team/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Channel is a transport, never a destination — this tag is the only place
// it shows up, never a separate folder or filter the coordinator has to
// remember to check.
export const CHANNEL_META: Record<ConversationChannel, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  email:         { icon: Mail,          label: "Email" },
  sms:           { icon: Smartphone,    label: "Text" },
  portal:        { icon: MessageSquare, label: "Portal" },
  internal_note: { icon: StickyNote,    label: "Internal note" },
  phone_log:     { icon: Phone,         label: "Phone call" },
  voicemail:     { icon: Voicemail,     label: "Voicemail" },
  push:          { icon: Send,          label: "Push" },
};

// A bare aria-label on an SVG produces no visible hover affordance — a
// coordinator glancing at an unfamiliar icon (phone log? voicemail?) needs
// an actual tooltip, not just a screen-reader-only label, to "immediately
// understand what's happening" per the evaluation questions this tab was
// built against.
function ChannelIcon({ channel }: { channel: ConversationChannel }) {
  const meta = CHANNEL_META[channel] ?? CHANNEL_META.portal;
  const Icon = meta.icon;
  return (
    <span title={meta.label} className="inline-flex">
      <Icon className="h-3 w-3" aria-label={meta.label} />
    </span>
  );
}

// Communication Trust Experience — a failed/undelivered message is never a
// dead end. "Retry" and "Use email/text" prefill the compose box rather
// than silently re-sending — the coordinator confirms before anything goes
// out a second time.
function RecoveryActions({
  msg, leadId, clientId, onPrefill, onCreateTask,
}: {
  msg: ConversationMessage;
  leadId: string | null;
  clientId: string | null;
  onPrefill: (body: string, channel: ConversationChannel) => void;
  onCreateTask: () => void;
}) {
  const actions = deliveryRecoveryActions({
    channel: msg.channel,
    status: msg.status,
    leadId,
    clientId,
  });
  if (actions.length === 0) return null;

  const detailsHref = clientId ? `/clients/${clientId}` : leadId ? `/leads/${leadId}` : null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {actions.map((action) => {
        if (action.id === "retry") {
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onPrefill(msg.body, msg.channel)}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <RotateCcw className="h-2.5 w-2.5" /> {action.label}
            </button>
          );
        }
        if (action.id === "use_email") {
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onPrefill(msg.body, "email")}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              {action.label}
            </button>
          );
        }
        if (action.id === "use_sms") {
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onPrefill(msg.body, "sms")}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              {action.label}
            </button>
          );
        }
        if (action.id === "open_client" && detailsHref) {
          return (
            <Link
              key={action.id}
              href={detailsHref}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <User className="h-2.5 w-2.5" /> {action.label}
            </Link>
          );
        }
        if (action.id === "follow_up" && leadId) {
          return (
            <button
              key={action.id}
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <ListTodo className="h-2.5 w-2.5" /> {action.label}
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}

function isImageAttachment(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

function AttachmentList({
  attachments, isVenue, documentsHref,
}: {
  attachments: ConversationMessage["attachments"];
  isVenue: boolean;
  documentsHref: string | null;
}) {
  if (!attachments.length) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {attachments.map((a) => (
        <div key={a.id} className="space-y-0.5">
          <a
            href={a.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`block ${isImageAttachment(a.mimeType) ? "" : "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs underline-offset-2 hover:underline"} ${
              isImageAttachment(a.mimeType) ? "" : isVenue ? "bg-primary-foreground/10" : "bg-background/60"
            }`}
          >
            {isImageAttachment(a.mimeType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.fileUrl} alt={a.fileName} className="max-h-48 rounded-lg object-cover" />
            ) : (
              <><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{a.fileName}</span></>
            )}
          </a>
          {documentsHref && (
            <Link
              href={documentsHref}
              className={`block px-2 text-[10px] underline-offset-2 hover:underline ${
                isVenue ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              View in Documents
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

// RC2 — a message a Sequence/Scheduled Send produced on the venue's behalf
// looks identical to one a coordinator personally typed unless flagged —
// sender_type: "system" is the signal; this is its only rendering.
function AutomatedBadge({ isVenue }: { isVenue: boolean }) {
  return (
    <span
      title="Sent automatically by an Automation"
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
        isVenue ? "bg-primary-foreground/15 text-primary-foreground/80" : "bg-muted-foreground/10 text-muted-foreground"
      }`}
    >
      <Bot className="h-2.5 w-2.5" /> Automated
    </span>
  );
}

function Bubble({
  msg, leadId, clientId, eventId, onPrefill, onCreateTask,
}: {
  msg: ConversationMessage;
  leadId: string | null;
  clientId: string | null;
  eventId: string | null;
  onPrefill: (body: string, channel: ConversationChannel) => void;
  onCreateTask: (msg: ConversationMessage) => void;
}) {
  // Delivery badges only for provider-backed outbound (email/SMS). Portal /
  // notes / system-without-status must never imply delivery success.
  const isVenue = msg.senderType === "venue_staff" || msg.senderType === "system";
  const delivery = resolveDeliveryDisplay({
    status: msg.status,
    channel: msg.channel,
    failureReason: msg.failureReason,
    isOutbound: isVenue && (msg.channel === "email" || msg.channel === "sms"),
  });
  const showDelivery = !!delivery;
  const failed = !!delivery?.isFailure;
  const documentsHref = documentsWorkspaceHref({ leadId, clientId, eventId });
  return (
    <div className={`flex flex-col ${isVenue ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[min(42rem,88%)] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
          isVenue ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
        } ${failed ? "ring-1 ring-destructive/50" : ""}`}
      >
        {msg.senderType === "system" && (
          <div className="mb-1"><AutomatedBadge isVenue={isVenue} /></div>
        )}
        {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}
        {!msg.body && msg.attachments.length > 0 && (
          <p className="italic opacity-80">{msg.channel === "sms" ? "Photo or file" : "Attachment"}</p>
        )}
        <AttachmentList attachments={msg.attachments} isVenue={isVenue} documentsHref={documentsHref} />
        <span className={`mt-1 flex items-center gap-1 text-[10px] ${isVenue ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"}`}>
          <ChannelIcon channel={msg.channel} />
          {formatTime(msg.sentAt)}
          {showDelivery && (
            <MessageTimelinePopover
              messageId={msg.id}
              source="conversation"
              status={msg.status}
              failureReason={msg.failureReason}
              channel={msg.channel}
              isOutbound
            />
          )}
        </span>
      </div>
      {failed && (
        <RecoveryActions
          msg={msg}
          leadId={leadId}
          clientId={clientId}
          onPrefill={onPrefill}
          onCreateTask={() => onCreateTask(msg)}
        />
      )}
    </div>
  );
}

function DateSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[10px] font-medium text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function formatScheduledFor(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Not sent yet — never mixed into the real message history above. A
// scheduled-but-pending message is a different kind of fact than a message
// that actually went out (2026-07-14).
function ScheduledRow({ msg, onCancel }: { msg: ScheduledMessage; onCancel: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-heading">
          Scheduled for {formatScheduledFor(msg.scheduledFor)} · {msg.channel === "email" ? "Email" : "Text"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{msg.body}</p>
      </div>
      <button type="button" onClick={() => onCancel(msg.id)} aria-label="Cancel scheduled message"
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const NO_ASSIGNEE = "__none__";

export function ConversationThread({
  conversationId, onBack, showHeader = true, summary, teamMembers = [], initialBody, initialSubject,
  onInboxOpened, onInboxSent,
}: {
  conversationId: string;
  onBack?: () => void;
  showHeader?: boolean;
  /**
   * Enriched header content — name, Lead/Booking identity, compact event
   * orientation, assignee, and workspace link. Only the Inbox passes this;
   * the Booking Workspace's embedded Conversation tab omits it.
   */
  summary?: ConversationSummary;
  teamMembers?: StaffMember[];
  /**
   * Seeds the compose box (e.g. Luv→Messages "Use this draft"). A subject
   * implies email intent, so the channel defaults to email when present.
   */
  initialBody?: string;
  initialSubject?: string;
  /** Inbox list sync — called once after messages load (marks read + needs response). */
  onInboxOpened?: (needsResponse: boolean) => void;
  /** Inbox list sync — after a successful venue send. */
  onInboxSent?: (latestMessage: ConversationMessagePreview, needsResponse: boolean) => void;
}) {
  const [messages, setMessages] = React.useState<ConversationMessage[] | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  /** Stick to newest unless the user scrolls up into history. */
  const stickToBottomRef = React.useRef(true);
  const initialScrollDoneRef = React.useRef(false);
  const [scheduled, setScheduled] = React.useState<ScheduledMessage[]>([]);
  const [prefill, setPrefill] = React.useState<{ body: string; channel: ConversationChannel; nonce: number } | null>(null);
  const openedNotifiedRef = React.useRef(false);
  const onInboxOpenedRef = React.useRef(onInboxOpened);
  const onInboxSentRef = React.useRef(onInboxSent);
  onInboxOpenedRef.current = onInboxOpened;
  onInboxSentRef.current = onInboxSent;

  // Initializer-only — the Inbox remounts this component (key={conversationId})
  // whenever the selected conversation changes, so this never needs to
  // re-sync from the summary prop via an effect.
  const [assignedStaffId, setAssignedStaffId] = React.useState(summary?.assignedStaffId ?? NO_ASSIGNEE);
  const [automations, setAutomations] = React.useState<SequenceEnrollment[]>([]);
  /** Unambiguous event for Documents links — only when eventCount === 1 / eventUnambiguous. */
  const [docsEventId, setDocsEventId] = React.useState<string | null>(
    summary?.eventCount === 1 ? (summary.eventId ?? null) : null,
  );
  const relationshipId = summary?.relationshipId ?? null;
  React.useEffect(() => {
    if (!relationshipId) return;
    void getActiveEnrollmentsForConversationAction(relationshipId).then(setAutomations);
  }, [relationshipId]);

  React.useEffect(() => {
    if (!summary?.leadId && !summary?.clientId) {
      setDocsEventId(summary?.eventCount === 1 ? (summary.eventId ?? null) : null);
      return;
    }
    let cancelled = false;
    void getRelationshipContextAction(summary.leadId ?? null, summary.clientId ?? null)
      .then((ctx) => {
        if (cancelled) return;
        // Prefer authoritative relationship context when unambiguous; else summary enrichment.
        if (ctx.orientation?.eventUnambiguous && ctx.orientation.eventId) {
          setDocsEventId(ctx.orientation.eventId);
        } else if (summary.eventCount === 1 && summary.eventId) {
          setDocsEventId(summary.eventId);
        } else {
          setDocsEventId(null);
        }
      })
      .catch(() => {
        /* keep summary-derived docsEventId — do not hang */
      });
    return () => { cancelled = true; };
  }, [summary?.leadId, summary?.clientId, summary?.eventCount, summary?.eventId]);

  function handleAssignedStaffChange(value: string) {
    setAssignedStaffId(value);
    void setConversationAssignedStaffAction(conversationId, value === NO_ASSIGNEE ? null : value);
  }

  const loadScheduled = React.useCallback(async () => {
    setScheduled(await getScheduledForConversationAction(conversationId));
  }, [conversationId]);

  React.useEffect(() => {
    let cancelled = false;
    openedNotifiedRef.current = false;
    stickToBottomRef.current = true;
    initialScrollDoneRef.current = false;
    setMessages(null);
    void getConversationAction(conversationId)
      .then((detail) => {
        if (cancelled) return;
        const next = detail?.messages ?? [];
        setMessages(next);
        if (!openedNotifiedRef.current) {
          openedNotifiedRef.current = true;
          onInboxOpenedRef.current?.(conversationNeedsResponse(latestMeaningfulFromMessages(next)));
        }
      })
      .catch(() => {
        // Aborted/failed load must not leave the thread on permanent "Loading…"
        if (!cancelled) setMessages((prev) => prev ?? []);
      });
    void getScheduledForConversationAction(conversationId)
      .then((next) => {
        if (!cancelled) setScheduled(next);
      })
      .catch(() => {
        /* keep prior scheduled list */
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  function scrollMessagesToBottom(behavior: ScrollBehavior) {
    const el = scrollRef.current;
    if (!el) {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
      return;
    }
    if (behavior === "smooth") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }

  function handleMessagesScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 96;
  }

  // Open at newest; keep sticking only while the user is at (or near) the bottom.
  React.useLayoutEffect(() => {
    if (messages === null) return;
    if (!initialScrollDoneRef.current) {
      scrollMessagesToBottom("auto");
      initialScrollDoneRef.current = true;
      stickToBottomRef.current = true;
      return;
    }
    if (stickToBottomRef.current) {
      scrollMessagesToBottom("smooth");
    }
  }, [messages]);

  async function handleSent(ack?: SentMessageAck) {
    try {
      const detail = await getConversationAction(conversationId);
      const next = detail?.messages ?? [];
      setMessages(next);
      const last = next[next.length - 1];
      if (last && onInboxSentRef.current) {
        const preview: ConversationMessagePreview = {
          body: last.body,
          senderType: last.senderType,
          sentAt: last.sentAt,
          channel: last.channel,
        };
        onInboxSentRef.current(preview, conversationNeedsResponse(latestMeaningfulFromMessages(next)));
      }
    } catch {
      // Post-send refresh failed — reconcile from authoritative ack when present.
      if (ack) {
        setMessages((prev) => mergeSentAckIntoMessages(prev, ack));
        if (onInboxSentRef.current) {
          const channel = (ack.channel as ConversationChannel) || "email";
          const preview: ConversationMessagePreview = {
            body: ack.body,
            senderType: "venue_staff",
            sentAt: new Date().toISOString(),
            channel,
          };
          onInboxSentRef.current(preview, false);
        }
      } else {
        setMessages((prev) => prev ?? []);
      }
    }
  }

  // Communication Trust Experience, Phase 5 — loads a failed message back
  // into the compose box (same or an alternate channel) rather than
  // silently re-sending; the coordinator reviews and hits Send themselves.
  function prefillFromFailed(text: string, targetChannel: ConversationChannel) {
    setPrefill({ body: text, channel: targetChannel, nonce: Date.now() });
    const label = SENDABLE_CHANNEL_LABEL[targetChannel as keyof typeof SENDABLE_CHANNEL_LABEL] ?? CHANNEL_META[targetChannel].label;
    toast.info(`Loaded into the compose box as ${label} — review and send.`);
  }

  async function createFollowUpTask(msg: ConversationMessage) {
    if (!summary?.leadId) return;
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await addTaskAction(summary.leadId, {
      title: `Follow up — ${CHANNEL_META[msg.channel]?.label ?? msg.channel} didn't reach ${summary.displayName ?? "this lead"}`,
      dueDate,
    });
    if (result.ok) toast.success("Follow-up task created.");
    else toast.error(result.message ?? "Could not create the task.");
  }

  async function cancelScheduled(id: string) {
    if (!confirm("Cancel this scheduled message?")) return;
    const result = await cancelScheduledMessageAction(id);
    if (result.ok) await loadScheduled();
    else toast.error(result.message ?? "Could not cancel.");
  }

  const grouped: { label: string; msgs: ConversationMessage[] }[] = [];
  for (const m of messages ?? []) {
    const label = formatDateLabel(m.sentAt);
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) last.msgs.push(m);
    else grouped.push({ label, msgs: [m] });
  }

  const headerOrientation = summary ? conversationHeaderOrientation(summary) : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {showHeader && (
        <div className="shrink-0 border-b border-border/60">
          {/* Inbox list card holds identity + event context — header is workspace + controls only. */}
          <div className="flex items-center gap-2 px-4 py-2 sm:px-6">
            {onBack && (
              <button type="button" onClick={onBack} className="md:hidden -ml-1 shrink-0 p-1 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {summary ? (
              <>
                {headerOrientation?.workspaceHref && headerOrientation.workspaceLabel ? (
                  <Link
                    href={headerOrientation.workspaceHref}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    {headerOrientation.workspaceLabel}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Conversation</span>
                )}
                <div className="min-w-0 flex-1" />
                <select
                  aria-label="Assigned coordinator" value={assignedStaffId}
                  onChange={(e) => handleAssignedStaffChange(e.target.value)}
                  className="h-7 shrink-0 rounded-lg border border-border bg-background px-1.5 text-[11px]"
                >
                  <option value={NO_ASSIGNEE}>Unassigned</option>
                  {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </>
            ) : (
              <p className="text-sm font-medium">Conversation</p>
            )}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleMessagesScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6"
      >
        {messages === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet — say hello.</p>
        ) : (
          grouped.map((g) => (
            <div key={g.label}>
              <DateSep label={g.label} />
              <div className="space-y-2">
                {g.msgs.map((m) => (
                  <Bubble
                    key={m.id}
                    msg={m}
                    leadId={summary?.leadId ?? null}
                    clientId={summary?.clientId ?? null}
                    eventId={docsEventId}
                    onPrefill={prefillFromFailed}
                    onCreateTask={createFollowUpTask}
                  />
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {(scheduled.length > 0 || automations.length > 0) && (
        <details className="shrink-0 border-t border-border/60 bg-muted/20 open:bg-muted/30">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-heading marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
              {scheduled.length > 0 && (
                <span>{scheduled.length} scheduled</span>
              )}
              {scheduled.length > 0 && automations.length > 0 && <span className="text-muted-foreground">·</span>}
              {automations.length > 0 && (
                <span>{automations.length} automation{automations.length === 1 ? "" : "s"}</span>
              )}
              <span className="text-muted-foreground font-normal">— tap to expand</span>
            </span>
          </summary>
          <div className="max-h-40 space-y-1.5 overflow-y-auto border-t border-border/40 px-3 py-2">
            {scheduled.map((s) => <ScheduledRow key={s.id} msg={s} onCancel={cancelScheduled} />)}
            {automations.map((a) => {
              const total = a.stepsTotal ?? 0;
              const sent = a.stepsSent ?? 0;
              const stepNum = total > 0 ? Math.min(sent + 1, total) : null;
              const next = a.nextScheduledFor
                ? new Date(a.nextScheduledFor).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })
                : null;
              return (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2">
                  <Workflow className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-heading">In &ldquo;{a.sequenceName}&rdquo; automation</p>
                    {stepNum != null && (
                      <p className="text-[10px] text-muted-foreground">
                        Step {stepNum} of {total}{next ? ` · Next ${next}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      <ConversationCompose
        conversationId={conversationId}
        initialBody={initialBody}
        initialSubject={initialSubject}
        relationshipLabel={summary ? (summary.clientId ? "Booking" : "Lead") : null}
        prefill={prefill}
        onSent={handleSent}
        onScheduled={loadScheduled}
      />
    </div>
  );
}

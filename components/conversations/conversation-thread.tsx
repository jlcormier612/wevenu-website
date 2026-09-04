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
  ArrowLeft, Bot, Calendar, CheckCircle2, Clock, FileText, ListTodo, Mail, MessageSquare, Phone, RotateCcw, Send, Smartphone, StickyNote, User, Voicemail, Workflow, X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelScheduledMessageAction, getActiveEnrollmentsForConversationAction, getConversationAction,
  getScheduledForConversationAction, setConversationAssignedStaffAction,
} from "@/app/(app)/messaging/actions";
import {
  addTaskAction,
} from "@/app/(app)/leads/[id]/actions";
import { createRequestAction } from "@/app/(app)/requests/actions";
import { ConversationCompose } from "@/components/conversations/conversation-compose";
import { MessageTimelinePopover } from "@/components/messaging/message-timeline-popover";
import { SENDABLE_CHANNEL_LABEL } from "@/lib/conversations/channels";
import type { ConversationChannel, ConversationMessage, ConversationSummary } from "@/lib/conversations/types";
import type { SequenceEnrollment } from "@/lib/message-sequences/types";
import type { ScheduledMessage } from "@/lib/scheduled-messages/types";
import type { StaffMember } from "@/lib/team/types";

function threadInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(/[\s&]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

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
  sms:           { icon: Smartphone,    label: "SMS" },
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

// Communication Trust Experience, Phase 5 — a failed message is never a
// dead end. "Retry" and "Send as X instead" prefill the compose box rather
// than silently re-sending — the coordinator confirms before anything goes
// out a second time, same "system proposes, human confirms" principle used
// elsewhere in this codebase, and email in particular has no stored subject
// to safely resend without a look.
function RecoveryActions({
  msg, leadId, onPrefill, onCreateTask,
}: {
  msg: ConversationMessage;
  leadId: string | null;
  onPrefill: (body: string, channel: ConversationChannel) => void;
  onCreateTask: () => void;
}) {
  const altChannel: ConversationChannel | null = msg.channel === "email" ? "sms" : msg.channel === "sms" ? "email" : null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      <button type="button" onClick={() => onPrefill(msg.body, msg.channel)} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
        <RotateCcw className="h-2.5 w-2.5" /> Retry
      </button>
      {altChannel && (
        <button type="button" onClick={() => onPrefill(msg.body, altChannel)} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
          Send as {altChannel === "sms" ? "text" : "email"} instead
        </button>
      )}
      {leadId && (
        <button type="button" onClick={onCreateTask} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
          <ListTodo className="h-2.5 w-2.5" /> Follow up later
        </button>
      )}
    </div>
  );
}

function isImageAttachment(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

function AttachmentList({ attachments, isVenue }: { attachments: ConversationMessage["attachments"]; isVenue: boolean }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {attachments.map((a) => (
        <a
          key={a.id}
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
  msg, leadId, onPrefill, onCreateTask,
}: {
  msg: ConversationMessage;
  leadId: string | null;
  onPrefill: (body: string, channel: ConversationChannel) => void;
  onCreateTask: (msg: ConversationMessage) => void;
}) {
  const isVenue = msg.senderType === "venue_staff" || msg.senderType === "system";
  return (
    <div className={`flex flex-col ${isVenue ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[72%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
          isVenue ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {msg.senderType === "system" && (
          <div className="mb-1"><AutomatedBadge isVenue={isVenue} /></div>
        )}
        {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}
        <AttachmentList attachments={msg.attachments} isVenue={isVenue} />
        <span className={`mt-1 flex items-center gap-1 text-[10px] ${isVenue ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"}`}>
          <ChannelIcon channel={msg.channel} />
          {formatTime(msg.sentAt)}
          <MessageTimelinePopover messageId={msg.id} source="conversation" status={msg.status} failureReason={msg.failureReason} isOutbound={isVenue} />
        </span>
      </div>
      {isVenue && msg.status === "failed" && (
        <RecoveryActions msg={msg} leadId={leadId} onPrefill={onPrefill} onCreateTask={() => onCreateTask(msg)} />
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
          Scheduled for {formatScheduledFor(msg.scheduledFor)} · {msg.channel === "email" ? "Email" : "SMS"}
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
}: {
  conversationId: string;
  onBack?: () => void;
  showHeader?: boolean;
  /**
   * Enriched header content — name, Client/Booking shortcuts, Assigned
   * Coordinator, Active Automations (Communication Workspace Completion,
   * Requirement 3). Only the Inbox passes this; the Booking Workspace's
   * embedded Conversation tab omits it and stays exactly as it was.
   */
  summary?: ConversationSummary;
  teamMembers?: StaffMember[];
  /**
   * RC2, Milestone 5 — seeds the compose box (e.g. the Luv→Messages "Use
   * this draft" bridge in lead-detail.tsx). A subject implies email intent,
   * so the channel defaults to email when one is present, same as the
   * legacy MessagesSection this replaces.
   */
  initialBody?: string;
  initialSubject?: string;
}) {
  const [messages, setMessages] = React.useState<ConversationMessage[] | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [scheduled, setScheduled] = React.useState<ScheduledMessage[]>([]);
  const [prefill, setPrefill] = React.useState<{ body: string; channel: ConversationChannel; nonce: number } | null>(null);

  // RC2, Milestone 4 — "Create Request" from this Conversation. source_id
  // is the conversation's id (not one specific message), so the Request's
  // "Open Related Item" always lands back on the discussion.
  const [requestFormOpen, setRequestFormOpen] = React.useState(false);
  const [requestTitle, setRequestTitle] = React.useState("");
  const [creatingRequest, setCreatingRequest] = React.useState(false);

  // Initializer-only — the Inbox remounts this component (key={conversationId})
  // whenever the selected conversation changes, so this never needs to
  // re-sync from the summary prop via an effect.
  const [assignedStaffId, setAssignedStaffId] = React.useState(summary?.assignedStaffId ?? NO_ASSIGNEE);
  const [automations, setAutomations] = React.useState<SequenceEnrollment[]>([]);
  const relationshipId = summary?.relationshipId ?? null;
  React.useEffect(() => {
    if (!relationshipId) return;
    void getActiveEnrollmentsForConversationAction(relationshipId).then(setAutomations);
  }, [relationshipId]);

  function handleAssignedStaffChange(value: string) {
    setAssignedStaffId(value);
    void setConversationAssignedStaffAction(conversationId, value === NO_ASSIGNEE ? null : value);
  }

  const load = React.useCallback(async () => {
    const detail = await getConversationAction(conversationId);
    setMessages(detail?.messages ?? []);
  }, [conversationId]);

  const loadScheduled = React.useCallback(async () => {
    setScheduled(await getScheduledForConversationAction(conversationId));
  }, [conversationId]);

  React.useEffect(() => {
    let cancelled = false;
    void getConversationAction(conversationId).then((detail) => {
      if (!cancelled) setMessages(detail?.messages ?? []);
    });
    void getScheduledForConversationAction(conversationId).then((next) => {
      if (!cancelled) setScheduled(next);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

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

  async function createRequestFromConversation() {
    const title = requestTitle.trim();
    if (!title || !summary?.clientId || creatingRequest) return;
    setCreatingRequest(true);
    const result = await createRequestAction({
      clientId: summary.clientId,
      title,
      requestType: "information",
      sourceFeature: "conversation",
      sourceId: conversationId,
    });
    setCreatingRequest(false);
    if (result.ok) {
      toast.success("Request created.");
      setRequestTitle("");
      setRequestFormOpen(false);
    } else {
      toast.error(result.error ?? "Could not create the request.");
    }
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {showHeader && (
        <div className="shrink-0 border-b border-border/60">
          <div className="flex items-center gap-2 px-4 py-3">
            {onBack && (
              <button type="button" onClick={onBack} className="md:hidden -ml-1 p-1 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {summary ? (
              <>
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{threadInitials(summary.displayName)}</span>
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-heading">
                  {summary.displayName ?? "Unnamed relationship"}
                </p>
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
          {summary && (summary.leadId || summary.clientId) && (
            <div className="flex flex-wrap items-center gap-3 px-4 pb-3 text-xs">
              {summary.leadId && (
                <Link href={`/leads/${summary.leadId}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <User className="h-3 w-3" /> Client
                </Link>
              )}
              {summary.clientId && (
                <Link href={`/clients/${summary.clientId}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <Calendar className="h-3 w-3" /> Booking
                </Link>
              )}
              {/* RC2, Milestone 4 — Requests need a Client, not just a Lead
                  (requests.client_id is not-null), so this only appears once
                  the relationship has booked. */}
              {summary.clientId && (
                <button
                  type="button"
                  onClick={() => setRequestFormOpen((v) => !v)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <CheckCircle2 className="h-3 w-3" /> Create Request
                </button>
              )}
            </div>
          )}
          {requestFormOpen && (
            <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2">
              <input
                type="text"
                autoFocus
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void createRequestFromConversation(); if (e.key === "Escape") setRequestFormOpen(false); }}
                placeholder="Request title — e.g. Confirm final guest count"
                className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs"
              />
              <button type="button" onClick={() => void createRequestFromConversation()} disabled={!requestTitle.trim() || creatingRequest}
                className="h-8 shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">
                {creatingRequest ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setRequestFormOpen(false)}
                className="h-8 shrink-0 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
                  <Bubble key={m.id} msg={m} leadId={summary?.leadId ?? null} onPrefill={prefillFromFailed} onCreateTask={createFollowUpTask} />
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

      <div className="shrink-0 border-t border-border/60">
        <ConversationCompose
          conversationId={conversationId}
          initialBody={initialBody}
          initialSubject={initialSubject}
          prefill={prefill}
          onSent={load}
          onScheduled={loadScheduled}
        />
      </div>
    </div>
  );
}

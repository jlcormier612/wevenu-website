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
  ArrowLeft, Calendar, Clock, ListTodo, Mail, MessageSquare, Phone, RotateCcw, Send, Smartphone, StickyNote, User, Voicemail, Workflow, X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelScheduledMessageAction, getActiveEnrollmentsForConversationAction, getComposeTemplatesAction, getConversationAction,
  getScheduledForConversationAction, scheduleMessageAction, sendConversationMessageAction, setConversationAssignedStaffAction,
} from "@/app/(app)/messaging/actions";
import { addTaskAction } from "@/app/(app)/leads/[id]/actions";
import { MessageTimelinePopover } from "@/components/messaging/message-timeline-popover";
import type { ConversationChannel, ConversationMessage, ConversationSummary } from "@/lib/conversations/types";
import type { SequenceEnrollment } from "@/lib/message-sequences/types";
import type { MessageTemplate } from "@/lib/message-templates/types";
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
        className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isVenue ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.body}</p>
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

// datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's local time — a
// sensible default one hour out, never a time already in the past.
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const NO_ASSIGNEE = "__none__";

export function ConversationThread({
  conversationId, onBack, showHeader = true, summary, teamMembers = [],
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
}) {
  const [messages, setMessages] = React.useState<ConversationMessage[] | null>(null);
  const [body, setBody] = React.useState("");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [channel, setChannel] = React.useState<ConversationChannel>("portal");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = React.useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = React.useState("");

  const [scheduled, setScheduled] = React.useState<ScheduledMessage[]>([]);
  const [schedulePanelOpen, setSchedulePanelOpen] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState(defaultScheduleValue);
  const [scheduling, setScheduling] = React.useState(false);

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

  React.useEffect(() => { void load(); void loadScheduled(); }, [load, loadScheduled]);
  React.useEffect(() => { void getComposeTemplatesAction().then(setTemplates); }, []);
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // Templates are Email/SMS content, not a "portal" or "internal note"
  // concept — only offered (and only used to prefill) for those two
  // channels, matching how the Message Template Library itself is scoped.
  const templatesForChannel = templates.filter((t) =>
    channel === "email" ? !!t.emailBody : channel === "sms" ? !!t.smsBody : false);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (!t) return;
    if (channel === "email") {
      setBody(t.emailBody ?? "");
      setEmailSubject(t.emailSubject ?? "");
    } else if (channel === "sms") {
      setBody(t.smsBody ?? "");
    }
  }

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    if (channel === "email" && !emailSubject.trim()) {
      toast.error("An email needs a subject line.");
      return;
    }
    setSending(true);
    // Real sends (email, sms) can genuinely fail — don't clear the draft or
    // pretend success until the result is known, unlike the old DB-only-write
    // path where every channel here trivially "succeeded" (2026-07-11; email
    // corrected 2026-07-14 — it looked real but wasn't, see product-backlog.md).
    const result = await sendConversationMessageAction(conversationId, text, channel, emailSubject);
    if (result.ok) {
      setBody("");
      setEmailSubject("");
      setTemplateId("");
      await load();
    } else {
      toast.error(result.message ?? "Could not send message.");
    }
    setSending(false);
  }

  // Communication Trust Experience, Phase 5 — loads a failed message back
  // into the compose box (same or an alternate channel) rather than
  // silently re-sending; the coordinator reviews and hits Send themselves.
  function prefillFromFailed(text: string, targetChannel: ConversationChannel) {
    setChannel(targetChannel);
    setBody(text);
    if (targetChannel !== "email") setEmailSubject("");
    toast.info(targetChannel === channel ? "Loaded back into the compose box — review and send." : `Loaded into the compose box as ${CHANNEL_META[targetChannel].label} — review and send.`);
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

  async function confirmSchedule() {
    const text = body.trim();
    if (!text || scheduling) return;
    if (channel !== "email" && channel !== "sms") return; // Scheduled Sends is Email/SMS only — §5.1
    setScheduling(true);
    const iso = new Date(scheduledFor).toISOString();
    const result = await scheduleMessageAction(conversationId, templateId || null, channel, emailSubject, text, iso);
    if (result.ok) {
      toast.success(`Scheduled for ${formatScheduledFor(iso)}.`);
      setBody(""); setEmailSubject(""); setTemplateId(""); setSchedulePanelOpen(false);
      await loadScheduled();
    } else {
      toast.error(result.message ?? "Could not schedule this message.");
    }
    setScheduling(false);
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

  const canSchedule = channel === "email" || channel === "sms";

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="border-b border-border/60">
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
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
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

      {scheduled.length > 0 && (
        <div className="space-y-1.5 border-t border-border/60 px-3 py-2">
          {scheduled.map((s) => <ScheduledRow key={s.id} msg={s} onCancel={cancelScheduled} />)}
        </div>
      )}

      {summary && automations.length > 0 && (
        <div className="space-y-1.5 border-t border-border/60 px-3 py-2">
          {automations.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
              <Workflow className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs font-medium text-heading">In &ldquo;{a.sequenceName}&rdquo; automation</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border/60 p-3 space-y-2">
        {templatesForChannel.length > 0 && (
          <select
            aria-label="Use a template"
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
          >
            <option value="">Use a template…</option>
            {templatesForChannel.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {channel === "email" && (
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Subject"
            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm"
          />
        )}

        {schedulePanelOpen && (
          <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs"
              />
              <button type="button" onClick={() => void confirmSchedule()} disabled={!body.trim() || scheduling}
                className="h-8 shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">
                {scheduling ? "Scheduling…" : "Confirm"}
              </button>
              <button type="button" onClick={() => setSchedulePanelOpen(false)}
                className="h-8 shrink-0 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <select
            aria-label="Channel"
            value={channel}
            onChange={(e) => { setChannel(e.target.value as ConversationChannel); setTemplateId(""); }}
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
          >
            {(Object.keys(CHANNEL_META) as ConversationChannel[]).map((c) => (
              <option key={c} value={c}>{CHANNEL_META[c].label}</option>
            ))}
          </select>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {canSchedule && (
            <button
              type="button"
              onClick={() => setSchedulePanelOpen((p) => !p)}
              aria-label="Schedule for later"
              title="Schedule for later"
              className={`h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center ${
                schedulePanelOpen ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void send()}
            disabled={!body.trim() || sending || (channel === "email" && !emailSubject.trim())}
            className="h-9 w-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

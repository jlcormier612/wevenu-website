"use client";

/**
 * Conversation compose surface — outbound Email / Text / Portal message,
 * with Internal note as a separate staff-only mode (not another send channel).
 * Destination, channel readiness, resolved preview, and labeled Send now /
 * Schedule actions live here. Enter does not send.
 */
import * as React from "react";
import Link from "next/link";
import { Clock, Paperclip, StickyNote, X } from "lucide-react";
import { toast } from "sonner";

import {
  addConversationMessageAttachmentAction,
  getComposeTemplatesAction,
  getConversationComposeContextAction,
  previewConversationSendAction,
  scheduleMessageAction,
  sendConversationMessageAction,
} from "@/app/(app)/messaging/actions";
import {
  OUTBOUND_CHANNEL_LABEL,
  OUTBOUND_CHANNELS,
  isOutboundChannel,
  isSendableChannel,
  type OutboundChannel,
  type SendableChannel,
} from "@/lib/conversations/channels";
import type { ConversationChannel, ConversationComposeContext, ConversationSendPreview } from "@/lib/conversations/types";
import type { MessageTemplate } from "@/lib/message-templates/types";
import type { ScheduledMessageChannel } from "@/lib/scheduled-messages/types";

function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduledFor(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type ComposeMode = "outbound" | "internal_note";

export function ConversationCompose({
  conversationId,
  initialBody,
  initialSubject,
  relationshipLabel,
  prefill,
  onSent,
  onScheduled,
}: {
  conversationId: string;
  initialBody?: string;
  initialSubject?: string;
  /** "Lead" or "Booking" — same language as the Messages list badge. */
  relationshipLabel?: "Lead" | "Booking" | null;
  prefill?: { body: string; channel: ConversationChannel; nonce: number } | null;
  onSent: () => Promise<void> | void;
  onScheduled: () => Promise<void> | void;
}) {
  const [context, setContext] = React.useState<ConversationComposeContext | null>(null);
  const [body, setBody] = React.useState(initialBody ?? "");
  const [emailSubject, setEmailSubject] = React.useState(initialSubject ?? "");
  const [mode, setMode] = React.useState<ComposeMode>("outbound");
  const [outboundChannel, setOutboundChannel] = React.useState<OutboundChannel>(initialSubject ? "email" : "portal");
  const [sending, setSending] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = React.useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = React.useState("");
  const [schedulePanelOpen, setSchedulePanelOpen] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState(defaultScheduleValue);
  const [scheduling, setScheduling] = React.useState(false);
  const [preview, setPreview] = React.useState<ConversationSendPreview | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [confirm, setConfirm] = React.useState<
    | { kind: "sent"; channel: SendableChannel }
    | { kind: "scheduled"; when: string; channel: SendableChannel }
    | { kind: "failed"; message: string }
    | null
  >(null);
  const [appliedPrefillNonce, setAppliedPrefillNonce] = React.useState<number | null>(null);

  const channel: SendableChannel = mode === "internal_note" ? "internal_note" : outboundChannel;

  if (prefill && prefill.nonce !== appliedPrefillNonce) {
    setAppliedPrefillNonce(prefill.nonce);
    if (isSendableChannel(prefill.channel)) {
      if (prefill.channel === "internal_note") {
        setMode("internal_note");
      } else if (isOutboundChannel(prefill.channel)) {
        setMode("outbound");
        setOutboundChannel(prefill.channel);
      }
    }
    setBody(prefill.body);
    if (prefill.channel !== "email") setEmailSubject("");
  }

  React.useEffect(() => {
    void getConversationComposeContextAction(conversationId).then((ctx) => {
      setContext(ctx);
      if (initialSubject && ctx && !ctx.emailReady) setOutboundChannel("portal");
    });
    void getComposeTemplatesAction().then(setTemplates);
  }, [conversationId, initialSubject]);

  const emailReady = !context || context.emailReady;
  const smsReady = !context || context.smsReady;
  const channelReady =
    channel === "email" ? emailReady : channel === "sms" ? smsReady : true;
  const channelDisabledReason =
    channel === "email" && !emailReady
      ? context?.sendingDisabled
        ? "Sending is turned off in this environment."
        : "Email isn't ready to send yet. Open Communication Health to see why."
      : channel === "sms" && !smsReady
        ? context?.sendingDisabled
          ? "Sending is turned off in this environment."
          : "Texting isn't set up yet. Open Communication Health to see why."
        : null;

  const templatesForChannel = templates.filter((t) =>
    channel === "email" ? !!t.emailBody : channel === "sms" ? !!t.smsBody : false);

  React.useEffect(() => {
    if (channel !== "email" && channel !== "sms") return;
    const text = body;
    const subject = emailSubject;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewing(true);
      void previewConversationSendAction(conversationId, text, subject).then((next) => {
        if (!cancelled) {
          setPreview(next);
          setPreviewing(false);
        }
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [body, emailSubject, channel, conversationId]);

  async function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (!t) return;
    const rawBody = channel === "email" ? (t.emailBody ?? "") : (t.smsBody ?? "");
    const rawSubject = channel === "email" ? (t.emailSubject ?? "") : "";
    const resolved = await previewConversationSendAction(conversationId, rawBody, rawSubject);
    setBody(resolved.body);
    setEmailSubject(resolved.subject);
    setPreview(resolved);
    if (resolved.unresolvedMessage) toast.error(resolved.unresolvedMessage);
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File exceeds 20 MB limit.");
      return;
    }
    setPendingFile(file);
  }

  function switchMode(next: ComposeMode) {
    setMode(next);
    setTemplateId("");
    setSchedulePanelOpen(false);
    setConfirm(null);
    setPendingFile(null);
    if (next === "internal_note") setEmailSubject("");
  }

  const who = context?.displayName ?? "this relationship";
  const relationshipLine = context
    ? `${who}${relationshipLabel ? ` · ${relationshipLabel}` : ""}`
    : "Loading relationship…";

  const recipientLine = (() => {
    if (!context) return "Loading recipient…";
    if (channel === "email") {
      return context.recipientEmail
        ? `To: ${context.recipientEmail}`
        : "No email address on file for this person — add one to their record before sending.";
    }
    if (channel === "sms") {
      return context.recipientPhoneDisplay || context.recipientPhone
        ? `To: ${context.recipientPhoneDisplay ?? context.recipientPhone}`
        : "No phone number on file for this person — add one to their record before sending.";
    }
    if (channel === "portal") {
      const kind = context.conversationKind === "venue_vendor"
        ? `${who} (vendor)`
        : who;
      return `Portal message to ${kind} in Hello to Cheers — they will see this in their portal, not as a separate email or text.`;
    }
    return "Visible only to your venue team. Couples and vendors will never see this.";
  })();

  async function send() {
    const text = body.trim();
    if ((!text && !pendingFile) || sending || uploadingFile) return;
    if (!channelReady) {
      toast.error(channelDisabledReason ?? "This channel isn't ready to send.");
      return;
    }
    if (channel === "email" && !emailSubject.trim()) {
      toast.error("An email needs a subject line.");
      return;
    }
    if (pendingFile && channel !== "portal" && channel !== "internal_note") {
      toast.error("Attachments can only be sent on Portal or Internal Note messages right now.");
      return;
    }
    setSending(true);
    setConfirm(null);

    let uploaded: { url: string; name: string; size: number; mimeType: string } | null = null;
    if (pendingFile) {
      setUploadingFile(true);
      try {
        const form = new FormData();
        form.append("file", pendingFile);
        form.append("conversationId", conversationId);
        const res = await fetch("/api/conversations/upload", { method: "POST", body: form });
        const data = await res.json() as { ok: boolean; url?: string; file_name?: string; file_size?: number; mime_type?: string; error?: string };
        if (!data.ok || !data.url) {
          setConfirm({ kind: "failed", message: data.error ?? "Upload failed." });
          toast.error(data.error ?? "Upload failed.");
          setSending(false);
          setUploadingFile(false);
          return;
        }
        uploaded = { url: data.url, name: data.file_name ?? pendingFile.name, size: data.file_size ?? pendingFile.size, mimeType: data.mime_type ?? pendingFile.type };
      } catch {
        setConfirm({ kind: "failed", message: "Upload failed." });
        toast.error("Upload failed.");
        setSending(false);
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    const result = await sendConversationMessageAction(conversationId, text, channel, emailSubject, !!uploaded);
    if (result.ok) {
      if (uploaded) {
        await addConversationMessageAttachmentAction(result.messageId, uploaded);
      }
      setBody("");
      setEmailSubject("");
      setTemplateId("");
      setPendingFile(null);
      setPreview(null);
      setConfirm({ kind: "sent", channel });
      await onSent();
    } else {
      const message = result.message ?? "Could not send message.";
      setConfirm({ kind: "failed", message });
      toast.error(message);
    }
    setSending(false);
  }

  async function confirmSchedule() {
    const text = body.trim();
    if (!text || scheduling) return;
    if (channel !== "email" && channel !== "sms") return;
    if (!channelReady) {
      toast.error(channelDisabledReason ?? "This channel isn't ready to schedule.");
      return;
    }
    setScheduling(true);
    const iso = new Date(scheduledFor).toISOString();
    const result = await scheduleMessageAction(
      conversationId,
      templateId || null,
      channel as ScheduledMessageChannel,
      emailSubject,
      text,
      iso,
    );
    if (result.ok) {
      setBody("");
      setEmailSubject("");
      setTemplateId("");
      setSchedulePanelOpen(false);
      setPreview(null);
      setConfirm({ kind: "scheduled", when: formatScheduledFor(iso), channel });
      await onScheduled();
    } else {
      const message = result.message ?? "Could not schedule this message.";
      setConfirm({ kind: "failed", message });
      toast.error(message);
    }
    setScheduling(false);
  }

  const canSchedule = (channel === "email" || channel === "sms") && channelReady;
  const sendDisabled =
    (!body.trim() && !pendingFile) ||
    sending ||
    uploadingFile ||
    !channelReady ||
    (channel === "email" && !emailSubject.trim());

  const sendLabel =
    channel === "email" ? "Send email now"
    : channel === "sms" ? "Send text now"
    : channel === "portal" ? "Send portal message"
    : "Save internal note";

  const isNote = mode === "internal_note";

  return (
    <div
      className={`max-h-[min(42vh,26rem)] shrink-0 space-y-3 overflow-y-auto border-t p-3 sm:p-4 ${
        isNote
          ? "border-amber-500/25 bg-amber-500/[0.04]"
          : "border-border/60 bg-card"
      }`}
    >
      {confirm?.kind === "sent" && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-heading" role="status">
          {confirm.channel === "email" && "Email sent — it left Hello to Cheers through email."}
          {confirm.channel === "sms" && "Text sent — it left Hello to Cheers through texting."}
          {confirm.channel === "portal" && "Portal message delivered in Hello to Cheers."}
          {confirm.channel === "internal_note" && "Internal note saved for your venue team."}
        </p>
      )}
      {confirm?.kind === "scheduled" && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-heading" role="status">
          Scheduled for {confirm.when} — not sent yet.
        </p>
      )}
      {confirm?.kind === "failed" && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-heading" role="alert">
          Not sent. {confirm.message}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Compose mode">
        <button
          type="button"
          onClick={() => switchMode("outbound")}
          className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium transition-colors ${
            !isNote
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          Message
        </button>
        <button
          type="button"
          onClick={() => switchMode("internal_note")}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
            isNote
              ? "bg-amber-700 text-amber-50"
              : "border border-border bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          <StickyNote className="h-3.5 w-3.5" />
          Internal note
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isNote ? "About" : "Relationship"}
        </p>
        <p className="text-sm font-medium text-heading">{relationshipLine}</p>
        <p className="text-sm text-muted-foreground">{recipientLine}</p>
      </div>

      {!isNote && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Channel</span>
            <select
              aria-label="Channel"
              value={outboundChannel}
              onChange={(e) => {
                setOutboundChannel(e.target.value as OutboundChannel);
                setTemplateId("");
                setConfirm(null);
                setSchedulePanelOpen(false);
              }}
              className="h-10 w-full rounded-lg border border-border bg-background px-2 text-sm"
            >
              {OUTBOUND_CHANNELS.map((c) => {
                const disabled = (c === "email" && !emailReady) || (c === "sms" && !smsReady);
                const label = OUTBOUND_CHANNEL_LABEL[c];
                return (
                  <option key={c} value={c} disabled={disabled}>
                    {disabled ? `${label} (not ready)` : label}
                  </option>
                );
              })}
            </select>
          </label>
          {templatesForChannel.length > 0 ? (
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Template</span>
              <select
                aria-label="Use a template"
                value={templateId}
                onChange={(e) => void applyTemplate(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="">Optional — use a template…</option>
                {templatesForChannel.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          ) : (
            <div />
          )}
        </div>
      )}

      {isNote && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          This is a staff note for your venue team — not a message to the couple or vendor.
        </p>
      )}

      {channelDisabledReason && (
        <p className="text-xs text-muted-foreground">
          {channelDisabledReason}{" "}
          <Link href="/messaging/health" className="underline hover:text-foreground">Communication Health</Link>
        </p>
      )}

      {channel === "email" && (
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email subject</span>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Subject"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isNote ? "Note" : "Message"}
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            isNote ? "Write a note for your team…"
            : channel === "portal" ? "Write a portal message…"
            : "Write the message…"
          }
          rows={6}
          className="min-h-[8.5rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed"
        />
      </label>

      {pendingFile && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-2.5 py-1.5">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-xs text-heading">{pendingFile.name}</span>
          {uploadingFile ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">Uploading…</span>
          ) : (
            <button type="button" onClick={() => setPendingFile(null)} aria-label="Remove attachment"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {(channel === "email" || channel === "sms") && (body.trim() || emailSubject.trim()) && (
        <details className="rounded-lg border border-border bg-muted/20 open:pb-0">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            {channel === "email" ? "Email preview" : "Text preview"}
            {previewing ? " · updating…" : " — tap to review what will send"}
          </summary>
          <div className="space-y-2 border-t border-border/50 px-3 py-3">
            {preview?.unresolvedMessage && (
              <p className="text-xs text-destructive">{preview.unresolvedMessage}</p>
            )}
            {channel === "sms" && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  To {context?.recipientPhoneDisplay ?? context?.recipientPhone ?? "the number on file"}
                </p>
                <p className="whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                  {preview?.body || body}
                </p>
              </div>
            )}
            {channel === "email" && (
              <div className="overflow-hidden rounded-lg border border-border bg-background">
                <div className="space-y-1 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  <p><span className="font-medium text-foreground">To:</span> {context?.recipientEmail ?? "—"}</p>
                  <p className="text-sm font-semibold text-heading">{preview?.subject || emailSubject || "(no subject)"}</p>
                </div>
                {preview?.html ? (
                  <iframe
                    title="Email preview"
                    sandbox=""
                    srcDoc={preview.html}
                    className="h-44 w-full bg-background"
                  />
                ) : (
                  <p className="whitespace-pre-wrap px-3 py-3 text-sm">{preview?.body || body}</p>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      {schedulePanelOpen && canSchedule && (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            This will be sent later — it is not sent now.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="h-10 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
            />
            <button type="button" onClick={() => void confirmSchedule()} disabled={!body.trim() || scheduling}
              className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40">
              {scheduling ? "Scheduling…" : "Confirm schedule"}
            </button>
            <button type="button" onClick={() => setSchedulePanelOpen(false)}
              className="h-10 shrink-0 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInputRef} type="file" onChange={handleFilePick} className="hidden" />
        {(channel === "portal" || channel === "internal_note") && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" /> Attach a file
          </button>
        )}
        {canSchedule && (
          <button
            type="button"
            onClick={() => setSchedulePanelOpen((p) => !p)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm ${
              schedulePanelOpen ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" /> Schedule
          </button>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={sendDisabled}
          className={`ml-auto inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium disabled:opacity-40 ${
            isNote
              ? "bg-amber-700 text-amber-50 hover:bg-amber-800"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {sending ? (isNote ? "Saving…" : "Sending…") : sendLabel}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {isNote
          ? "Saving is explicit — Enter does not save this note."
          : "Sending is explicit — Enter does not send. Review the channel and recipient above before you send."}
      </p>
    </div>
  );
}

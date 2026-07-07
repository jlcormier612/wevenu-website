"use client";

import * as React from "react";
import {
  ArrowLeft, FileText, Image as ImageIcon, MessageSquare,
  Paperclip, RotateCcw, Send, X,
} from "lucide-react";
import type { CoupleThread, CoupleMessage, CoupleInbox, ThreadDetail, MessageAttachment } from "@/lib/messages/types";

// ── Time helpers ──────────────────────────────────────────────────────────────

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

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024)       return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Attachment helpers ────────────────────────────────────────────────────────

type UploadItem = {
  id:       string;
  file:     File;
  status:   "uploading" | "done" | "error";
  progress: number;
  url?:     string;
  error?:   string;
};

function isImage(mime: string | null | undefined) { return !!mime?.startsWith("image/"); }
function isPdf(mime: string | null | undefined)   { return mime === "application/pdf"; }

function AttachmentPreview({ att }: { att: MessageAttachment }) {
  if (isImage(att.mime_type)) {
    return (
      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.file_url}
          alt={att.file_name}
          className="rounded-xl max-w-full object-cover"
          style={{ maxHeight: 220, maxWidth: 280 }}
        />
      </a>
    );
  }
  const Icon = isPdf(att.mime_type) ? FileText : FileText;
  return (
    <a
      href={att.file_url}
      download={att.file_name}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-2 rounded-lg px-3 py-2 bg-black/10 hover:bg-black/15 transition-colors max-w-[240px]"
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{att.file_name}</p>
        {att.file_size && <p className="text-[10px] opacity-60">{formatBytes(att.file_size)}</p>}
      </div>
    </a>
  );
}

// ── Name helpers ──────────────────────────────────────────────────────────────

function coupleName(t: { first_name: string; partner_first_name: string | null }): string {
  return [t.first_name, t.partner_first_name].filter(Boolean).join(" & ");
}
function threadInitials(t: { first_name: string; partner_first_name: string | null; last_name?: string | null }): string {
  return [t.first_name[0], t.partner_first_name?.[0] ?? t.last_name?.[0] ?? ""].join("").toUpperCase();
}

// ── Thread list item ──────────────────────────────────────────────────────────

function ThreadItem({ thread, isActive, onClick }: { thread: CoupleThread; isActive: boolean; onClick: () => void }) {
  const preview = thread.latest_message;
  const previewText = preview
    ? `${preview.sender_type === "venue" ? "You: " : ""}${preview.body || "📎 Attachment"}`
    : "No messages yet";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-border/40 transition-colors hover:bg-muted/30 ${isActive ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
    >
      <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
        <span className="text-xs font-semibold text-primary">{threadInitials(thread)}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium truncate ${thread.venue_unread > 0 ? "text-heading" : "text-foreground"}`}>
            {coupleName(thread)}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(thread.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs truncate ${thread.venue_unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {previewText}
          </p>
          {thread.venue_unread > 0 && (
            <span className="shrink-0 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {thread.venue_unread > 9 ? "9+" : thread.venue_unread}
            </span>
          )}
        </div>
        {thread.event_type && <p className="text-[10px] text-muted-foreground">{thread.event_type}</p>}
      </div>
    </button>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function Bubble({ msg, showSeen }: { msg: CoupleMessage; showSeen: boolean }) {
  const isVenue = msg.sender_type === "venue";
  const hasBody = msg.body.trim().length > 0;
  return (
    <div className={`flex flex-col ${isVenue ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isVenue
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {hasBody && <p>{msg.body}</p>}
        {msg.attachments?.map(att => <AttachmentPreview key={att.id} att={att} />)}
        <span className={`block text-[10px] mt-1 ${isVenue ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {formatTime(msg.created_at)}
        </span>
      </div>
      {showSeen && (
        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
          {isVenue ? "✓ Seen" : "✓ Seen by you"}
        </span>
      )}
    </div>
  );
}

// ── Date separator ────────────────────────────────────────────────────────────

function DateSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[10px] font-medium text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

// ── Upload chip (pending attachment) ─────────────────────────────────────────

function UploadChip({ item, onRemove, onRetry }: { item: UploadItem; onRemove: () => void; onRetry: () => void }) {
  const isImage_ = item.file.type.startsWith("image/");
  const preview  = isImage_ && item.status === "done" ? item.url : undefined;

  return (
    <div className={`relative flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs shrink-0 ${
      item.status === "error" ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40"
    }`}>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={item.file.name} className="h-8 w-8 rounded-lg object-cover" />
      ) : (
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
          {isImage_ ? <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      )}
      <div className="min-w-0 max-w-[100px]">
        <p className="truncate font-medium text-foreground">{item.file.name}</p>
        <p className="text-muted-foreground">
          {item.status === "uploading" ? `${item.progress}%` :
           item.status === "error"     ? "Failed" :
           formatBytes(item.file.size)}
        </p>
      </div>
      {item.status === "uploading" && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${item.progress}%` }} />
        </div>
      )}
      {item.status === "error" && (
        <button type="button" onClick={onRetry} className="text-destructive hover:opacity-80 transition-opacity">
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
      {item.status !== "uploading" && (
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Thread panel ──────────────────────────────────────────────────────────────

function ThreadPanel({ threadId, onBack }: { threadId: string; onBack?: () => void }) {
  const [detail, setDetail]       = React.useState<ThreadDetail | null>(null);
  const [loading, setLoading]     = React.useState(true);
  const [body, setBody]           = React.useState("");
  const [sending, setSending]     = React.useState(false);
  const [uploads, setUploads]     = React.useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef    = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/messages/${threadId}`);
    if (res.ok) setDetail(await res.json() as ThreadDetail);
    setLoading(false);
  }, [threadId]);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  // ── Upload a single file ──────────────────────────────────────────────────

  function uploadFile(file: File) {
    const id: string = `u-${Date.now()}-${Math.random()}`;
    setUploads(prev => [...prev, { id, file, status: "uploading", progress: 0 }]);

    const form = new FormData();
    form.append("file", file);
    form.append("threadId", threadId);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: Math.round(e.loaded / e.total * 100) } : u));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { ok: boolean; url?: string; file_name?: string };
        if (data.ok && data.url) {
          setUploads(prev => prev.map(u => u.id === id ? { ...u, status: "done", progress: 100, url: data.url, file_name: data.file_name } : u));
        } else {
          setUploads(prev => prev.map(u => u.id === id ? { ...u, status: "error", error: "Upload failed" } : u));
        }
      } catch {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, status: "error" } : u));
      }
    };
    xhr.onerror = () => {
      setUploads(prev => prev.map(u => u.id === id ? { ...u, status: "error" } : u));
    };
    xhr.open("POST", "/api/messages/upload");
    xhr.send(form);
  }

  function handleFiles(files: FileList | File[]) {
    Array.from(files).forEach(uploadFile);
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave()                   { setIsDragging(false); }
  function onDrop(e: React.DragEvent)      {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  const doneUploads    = uploads.filter(u => u.status === "done");
  const pendingUploads = uploads.filter(u => u.status === "uploading");
  const canSend        = (body.trim().length > 0 || doneUploads.length > 0) && pendingUploads.length === 0 && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);

    const text = body.trim();
    const optimistic: CoupleMessage = {
      id:             `opt-${Date.now()}`,
      sender_type:    "venue",
      body:           text,
      created_at:     new Date().toISOString(),
      venue_read_at:  null,
      couple_read_at: null,
      attachments:    [],
    };
    setDetail(prev => prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev);
    setBody("");
    setUploads([]);

    const res = await fetch(`/api/messages/${threadId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ body: text || " " }),
    });
    const result = await res.json() as { ok: boolean; message_id?: string };

    if (result.ok && result.message_id && doneUploads.length > 0) {
      await Promise.all(doneUploads.map(u =>
        fetch(`/api/messages/${threadId}/attachments`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            messageId: result.message_id,
            fileUrl:   u.url,
            fileName:  u.file.name,
            fileSize:  u.file.size,
            mimeType:  u.file.type,
          }),
        })
      ));
    }

    setSending(false);
    void load();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  // ── Read receipt helper ───────────────────────────────────────────────────

  const messages = detail?.messages ?? [];
  // Index of the last venue-sent message where couple has read it
  const lastSeenIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_type === "venue" && messages[i].couple_read_at) return i;
    }
    return -1;
  })();

  // ── Group by date ─────────────────────────────────────────────────────────

  type Group = { date: string; msgs: CoupleMessage[] };
  const groups: Group[] = [];
  let msgIdx = 0;
  const flatMsgs: CoupleMessage[] = [];
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at);
    const last  = groups[groups.length - 1];
    if (!last || last.date !== label) groups.push({ date: label, msgs: [msg] });
    else last.msgs.push(msg);
    flatMsgs.push(msg);
    msgIdx++;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Conversation not found.
      </div>
    );
  }

  const thread = detail.thread;
  let globalIdx = 0;

  return (
    <div
      className={`flex flex-col h-full transition-colors ${isDragging ? "bg-primary/5" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="rounded-2xl border-2 border-dashed border-primary px-8 py-6 bg-background/80 backdrop-blur text-center">
            <Paperclip className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-heading">Drop files to attach</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-card shrink-0">
        {onBack && (
          <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-primary">{threadInitials(thread)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-heading truncate">{coupleName(thread)}</p>
          {thread.event_type && <p className="text-[10px] text-muted-foreground">{thread.event_type}</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-heading">Start the conversation</p>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                Send a message or attach a file to get things started with {coupleName(thread)}.
              </p>
            </div>
          </div>
        ) : (
          groups.map(group => {
            const elements: React.ReactNode[] = [<DateSep key={`sep-${group.date}`} label={group.date} />];
            for (const msg of group.msgs) {
              const gIdx = flatMsgs.indexOf(msg);
              elements.push(
                <Bubble key={msg.id} msg={msg} showSeen={gIdx === lastSeenIdx} />
              );
            }
            return <React.Fragment key={group.date}>{elements}</React.Fragment>;
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending upload strip */}
      {uploads.length > 0 && (
        <div className="shrink-0 flex gap-2 px-4 py-2 overflow-x-auto border-t border-border/40">
          {uploads.map(u => (
            <UploadChip
              key={u.id}
              item={u}
              onRemove={() => setUploads(prev => prev.filter(x => x.id !== u.id))}
              onRetry={() => {
                setUploads(prev => prev.filter(x => x.id !== u.id));
                uploadFile(u.file);
              }}
            />
          ))}
        </div>
      )}

      {/* Compose */}
      <div className="shrink-0 border-t border-border/60 px-4 py-3 bg-card">
        <div className="flex items-end gap-2">
          {/* File picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 rounded-xl border border-border flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
          />

          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[40px] max-h-[120px]"
            style={{ overflowY: body.split("\n").length > 3 ? "auto" : "hidden" }}
          />

          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          ↵ Enter to send · Shift+↵ new line
          {pendingUploads.length > 0 && ` · Uploading ${pendingUploads.length} file${pendingUploads.length > 1 ? "s" : ""}…`}
        </p>
      </div>
    </div>
  );
}

// ── Right-panel empty state ───────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <MessageSquare className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-heading">Select a conversation</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Choose a couple from the list to view your conversation and share files.
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MessagingPage() {
  const [inbox,           setInbox]           = React.useState<CoupleInbox | null>(null);
  const [loading,         setLoading]         = React.useState(true);
  const [activeThreadId,  setActiveThreadId]  = React.useState<string | null>(null);
  const [mobileShowThread,setMobileShowThread]= React.useState(false);

  React.useEffect(() => {
    fetch("/api/messages")
      .then(r => r.json())
      .then((d: CoupleInbox) => setInbox(d))
      .catch(() => setInbox({ threads: [], total_unread: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const threads = inbox?.threads ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Page header */}
      <div className={`px-6 py-4 border-b border-border/60 shrink-0 ${mobileShowThread ? "hidden lg:block" : ""}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-heading">Messages</h1>
            <p className="text-xs text-muted-foreground">
              {inbox
                ? `${threads.length} conversation${threads.length !== 1 ? "s" : ""}${inbox.total_unread > 0 ? ` · ${inbox.total_unread} unread` : ""}`
                : "Loading…"}
            </p>
          </div>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left: thread list */}
        <div className={`w-full lg:w-80 xl:w-96 shrink-0 border-r border-border/60 flex flex-col min-h-0 ${mobileShowThread ? "hidden lg:flex" : "flex"}`}>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 rounded-full border-2 border-border border-t-primary animate-spin" />
              </div>
            ) : threads.length === 0 ? (
              <div className="px-6 py-16 text-center space-y-2">
                <MessageSquare className="h-7 w-7 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-heading">No conversations yet</p>
                <p className="text-xs text-muted-foreground">
                  Open a client record and start a conversation to see it here.
                </p>
              </div>
            ) : (
              threads.map(t => (
                <ThreadItem
                  key={t.id}
                  thread={t}
                  isActive={activeThreadId === t.id}
                  onClick={() => { setActiveThreadId(t.id); setMobileShowThread(true); }}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: thread detail */}
        <div className={`flex-1 min-w-0 flex flex-col ${mobileShowThread ? "flex" : "hidden lg:flex"}`}>
          {activeThreadId ? (
            <ThreadPanel
              key={activeThreadId}
              threadId={activeThreadId}
              onBack={mobileShowThread ? () => setMobileShowThread(false) : undefined}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

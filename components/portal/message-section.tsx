"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, Paperclip, RotateCcw, Send, X } from "lucide-react";
import type { CoupleMessage, MessageAttachment, PortalThread } from "@/lib/messages/types";

const SAGE  = "#5D6F5D";
const LINEN = "#F7F5F1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateLabel(iso: string): string {
  const d         = new Date(iso);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024)         return `${n} B`;
  if (n < 1024 * 1024)  return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Upload state ──────────────────────────────────────────────────────────────

type UploadItem = {
  id:       string;
  file:     File;
  status:   "uploading" | "done" | "error";
  progress: number;
  url?:     string;
  error?:   string;
};

// ── Attachment display inside bubble ─────────────────────────────────────────

function AttachmentDisplay({ att, isCouple }: { att: MessageAttachment; isCouple: boolean }) {
  const isImg = att.mime_type?.startsWith("image/");
  if (isImg) {
    return (
      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.file_url}
          alt={att.file_name}
          className="rounded-xl max-w-full object-cover"
          style={{ maxHeight: 200, maxWidth: 260 }}
        />
      </a>
    );
  }
  return (
    <a
      href={att.file_url}
      download={att.file_name}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 max-w-[220px]"
      style={{ background: isCouple ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)" }}
    >
      <FileText className="h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{att.file_name}</p>
        {att.file_size && <p className="text-[10px] opacity-60">{formatBytes(att.file_size)}</p>}
      </div>
    </a>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({
  msg, venueName, showSeen,
}: {
  msg:       CoupleMessage;
  venueName: string;
  showSeen:  boolean;
}) {
  const isCouple = msg.sender_type === "couple";
  const hasBody  = msg.body.trim().length > 0;
  return (
    <div className={`flex flex-col ${isCouple ? "items-end" : "items-start"}`}>
      <div className="flex items-end gap-2">
        {!isCouple && (
          <div
            className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white mb-1"
            style={{ background: SAGE }}
          >
            {venueName[0]?.toUpperCase() ?? "V"}
          </div>
        )}
        <div
          className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isCouple ? "rounded-br-sm text-white" : "rounded-bl-sm"
          }`}
          style={isCouple ? { background: SAGE } : { background: "#EDE9E3", color: "#3D3A35" }}
        >
          {hasBody && <p>{msg.body}</p>}
          {msg.attachments?.map(att => (
            <AttachmentDisplay key={att.id} att={att} isCouple={isCouple} />
          ))}
          <span
            className="block text-[10px] mt-1"
            style={{ color: isCouple ? "rgba(255,255,255,0.55)" : "#9A9188" }}
          >
            {formatTime(msg.created_at)}
          </span>
        </div>
      </div>
      {showSeen && (
        <span className="text-[10px] mt-0.5 px-1" style={{ color: "#9A9188" }}>
          {isCouple ? "✓ Seen by venue" : "✓ Seen"}
        </span>
      )}
    </div>
  );
}

// ── Date separator ────────────────────────────────────────────────────────────

function DateSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px" style={{ background: "#D4CEC7" }} />
      <span className="text-[10px] font-medium" style={{ color: "#9A9188" }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: "#D4CEC7" }} />
    </div>
  );
}

// ── Upload chip ───────────────────────────────────────────────────────────────

function UploadChip({ item, onRemove, onRetry }: { item: UploadItem; onRemove: () => void; onRetry: () => void }) {
  const isImg   = item.file.type.startsWith("image/");
  const preview = isImg && item.status === "done" ? item.url : undefined;
  return (
    <div
      className="relative flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs shrink-0"
      style={{ background: "#EDEBE6", border: `1px solid ${item.status === "error" ? "#C17F84" : "#D4CEC7"}` }}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={item.file.name} className="h-8 w-8 rounded-lg object-cover" />
      ) : (
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "#DDD9D2" }}>
          {isImg ? <ImageIcon className="h-3.5 w-3.5" style={{ color: "#9A9188" }} /> : <FileText className="h-3.5 w-3.5" style={{ color: "#9A9188" }} />}
        </div>
      )}
      <div className="min-w-0 max-w-[90px]">
        <p className="truncate font-medium" style={{ color: "#2D2B28" }}>{item.file.name}</p>
        <p style={{ color: "#9A9188" }}>
          {item.status === "uploading" ? `${item.progress}%` :
           item.status === "error"     ? "Failed" :
           formatBytes(item.file.size)}
        </p>
      </div>
      {item.status === "uploading" && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden" style={{ background: "#D4CEC7" }}>
          <div className="h-full transition-all duration-300" style={{ width: `${item.progress}%`, background: SAGE }} />
        </div>
      )}
      {item.status === "error" && (
        <button type="button" onClick={onRetry}>
          <RotateCcw className="h-3 w-3" style={{ color: "#C17F84" }} />
        </button>
      )}
      {item.status !== "uploading" && (
        <button type="button" onClick={onRemove}>
          <X className="h-3 w-3" style={{ color: "#9A9188" }} />
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PortalMessageSection({
  token,
  venueName,
}: {
  token:     string;
  venueName: string;
}) {
  const [threadId, setThreadId]     = React.useState<string | null>(null);
  const [messages, setMessages]     = React.useState<CoupleMessage[]>([]);
  const [loading, setLoading]       = React.useState(true);
  const [body, setBody]             = React.useState("");
  const [sending, setSending]       = React.useState(false);
  const [uploads, setUploads]       = React.useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef    = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/portal/messages?token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const d = await res.json() as PortalThread;
      setThreadId(d.thread_id);
      setMessages(d.messages ?? []);
    }
    setLoading(false);
  }, [token]);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Upload ────────────────────────────────────────────────────────────────

  function uploadFile(file: File) {
    const id = `u-${Date.now()}-${Math.random()}`;
    setUploads(prev => [...prev, { id, file, status: "uploading", progress: 0 }]);

    const form = new FormData();
    form.append("file", file);
    form.append("token", token);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: Math.round(e.loaded / e.total * 100) } : u));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { ok: boolean; url?: string };
        if (data.ok && data.url) {
          setUploads(prev => prev.map(u => u.id === id ? { ...u, status: "done", progress: 100, url: data.url } : u));
        } else {
          setUploads(prev => prev.map(u => u.id === id ? { ...u, status: "error" } : u));
        }
      } catch {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, status: "error" } : u));
      }
    };
    xhr.onerror = () => setUploads(prev => prev.map(u => u.id === id ? { ...u, status: "error" } : u));
    xhr.open("POST", "/api/portal/messages/upload");
    xhr.send(form);
  }

  function handleFiles(files: FileList | File[]) { Array.from(files).forEach(uploadFile); }

  // ── Drag and drop ─────────────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent)  { e.preventDefault(); setIsDragging(true); }
  function onDragLeave()                    { setIsDragging(false); }
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
      id: `opt-${Date.now()}`,
      sender_type: "couple",
      body: text,
      created_at: new Date().toISOString(),
      venue_read_at: null, couple_read_at: null, attachments: [],
    };
    setMessages(prev => [...prev, optimistic]);
    setBody("");
    setUploads([]);

    const res = await fetch("/api/portal/messages", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token, body: text || " " }),
    });
    const result = await res.json() as { ok: boolean; message_id?: string };

    if (result.ok && result.message_id && doneUploads.length > 0) {
      await Promise.all(doneUploads.map(u =>
        fetch("/api/portal/messages/attachments", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            token,
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

  // ── Read receipts ─────────────────────────────────────────────────────────

  // Last couple-sent message where venue has read it
  const lastSeenIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_type === "couple" && messages[i].venue_read_at) return i;
    }
    return -1;
  })();

  // ── Group by date ─────────────────────────────────────────────────────────

  type Group = { date: string; msgs: CoupleMessage[] };
  const groups: Group[] = [];
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at);
    const last  = groups[groups.length - 1];
    if (!last || last.date !== label) groups.push({ date: label, msgs: [msg] });
    else last.msgs.push(msg);
  }

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden relative"
      style={{
        background: isDragging ? "#F0EDE7" : LINEN,
        border:     "1px solid #DDD9D2",
        minHeight:  400,
        maxHeight:  "calc(100vh - 160px)",
        transition: "background 0.15s",
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="rounded-2xl px-8 py-6 text-center" style={{ background: "rgba(247,245,241,0.9)", border: `2px dashed ${SAGE}` }}>
            <Paperclip className="h-8 w-8 mx-auto mb-2" style={{ color: SAGE }} />
            <p className="text-sm font-medium" style={{ color: "#2D2B28" }}>Drop files to attach</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: "#EDEBE6", borderBottom: "1px solid #DDD9D2" }}
      >
        <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: SAGE }}>
          {venueName[0]?.toUpperCase() ?? "V"}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#2D2B28" }}>{venueName}</p>
          <p className="text-[10px]" style={{ color: "#9A9188" }}>Your venue team</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 rounded-full border-2 border-t-[#5D6F5D] animate-spin" style={{ borderColor: "#DDD9D2", borderTopColor: SAGE }} />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <p className="text-2xl">💬</p>
            <p className="text-sm font-medium" style={{ color: "#3D3A35" }}>
              Start a conversation with {venueName}
            </p>
            <p className="text-xs max-w-xs" style={{ color: "#9A9188" }}>
              Ask anything — timeline questions, vendor recommendations, logistics. Attach contracts or documents directly here.
            </p>
          </div>
        ) : (
          groups.map(group => (
            <React.Fragment key={group.date}>
              <DateSep label={group.date} />
              {group.msgs.map((msg, i) => {
                const globalIdx = messages.indexOf(msg);
                return (
                  <Bubble
                    key={msg.id}
                    msg={msg}
                    venueName={venueName}
                    showSeen={globalIdx === lastSeenIdx}
                  />
                );
              })}
            </React.Fragment>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Upload strip */}
      {uploads.length > 0 && (
        <div className="shrink-0 flex gap-2 px-4 py-2 overflow-x-auto" style={{ borderTop: "1px solid #DDD9D2", background: "#EDEBE6" }}>
          {uploads.map(u => (
            <UploadChip
              key={u.id}
              item={u}
              onRemove={() => setUploads(prev => prev.filter(x => x.id !== u.id))}
              onRetry={() => { setUploads(prev => prev.filter(x => x.id !== u.id)); uploadFile(u.file); }}
            />
          ))}
        </div>
      )}

      {/* Compose */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: "1px solid #DDD9D2", background: "#EDEBE6" }}>
        <div className="flex items-end gap-2">
          {/* File picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity hover:opacity-70"
            style={{ background: "#DDD9D2", color: "#5D6057" }}
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
            placeholder={`Message ${venueName}…`}
            rows={1}
            className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm focus:outline-none min-h-[40px] max-h-[120px]"
            style={{
              background: "#FAFAF8",
              border:     "1px solid #C8C2BB",
              color:      "#2D2B28",
              overflowY:  body.split("\n").length > 3 ? "auto" : "hidden",
            }}
          />

          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40 hover:opacity-80"
            style={{ background: SAGE }}
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: "#9A9188" }}>
          ↵ Enter to send · Shift+↵ new line
          {pendingUploads.length > 0 && ` · Uploading ${pendingUploads.length} file${pendingUploads.length > 1 ? "s" : ""}…`}
        </p>
      </div>
    </div>
  );
}

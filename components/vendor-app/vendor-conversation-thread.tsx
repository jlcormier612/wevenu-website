"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Bot, FileText, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import {
  addVendorConversationMessageAttachmentAction,
  sendVendorConversationMessageAction,
} from "@/app/vendor/messages/actions";
import { Button } from "@/components/ui/button";
import type { VendorConversationMessage } from "@/lib/conversations/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function isImageAttachment(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

function AttachmentList({ attachments, isVendor }: { attachments: VendorConversationMessage["attachments"]; isVendor: boolean }) {
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
            isImageAttachment(a.mimeType) ? "" : isVendor ? "bg-primary-foreground/10" : "bg-background/60"
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

function Bubble({ msg }: { msg: VendorConversationMessage }) {
  const isVendor = msg.senderType === "vendor";
  const isAutomated = msg.senderType === "system";
  return (
    <div className={`flex ${isVendor ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isVendor ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
        {isAutomated && (
          <div className="mb-1 flex items-center gap-1 text-[10px] opacity-75">
            <Bot className="h-3 w-3" /> Automated
          </div>
        )}
        {msg.body && <p className="whitespace-pre-wrap text-sm">{msg.body}</p>}
        <AttachmentList attachments={msg.attachments} isVendor={isVendor} />
        <p className={`mt-1 text-[10px] ${isVendor ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {formatTime(msg.sentAt)}
        </p>
      </div>
    </div>
  );
}

export function VendorConversationThread({
  conversationId, initialMessages, showHeader = true,
}: {
  conversationId: string;
  initialMessages: VendorConversationMessage[];
  /** RC2, Milestone 5 — false when embedded inline (e.g. an event workspace's own Messages tab, which already has its own heading), rather than as the standalone /vendor/messages/[conversationId] page. */
  showHeader?: boolean;
}) {
  const [messages, setMessages] = React.useState(initialMessages);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

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

  async function send() {
    const text = body.trim();
    if ((!text && !pendingFile) || sending || uploadingFile) return;
    setSending(true);

    let uploaded: { url: string; name: string; size: number; mimeType: string } | null = null;
    if (pendingFile) {
      setUploadingFile(true);
      try {
        const form = new FormData();
        form.append("file", pendingFile);
        form.append("conversationId", conversationId);
        const res = await fetch("/api/vendor/conversations/upload", { method: "POST", body: form });
        const data = await res.json() as { ok: boolean; url?: string; file_name?: string; file_size?: number; mime_type?: string; error?: string };
        if (!data.ok || !data.url) {
          toast.error(data.error ?? "Upload failed.");
          setSending(false);
          setUploadingFile(false);
          return;
        }
        uploaded = { url: data.url, name: data.file_name ?? pendingFile.name, size: data.file_size ?? pendingFile.size, mimeType: data.mime_type ?? pendingFile.type };
      } catch {
        toast.error("Upload failed.");
        setSending(false);
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    const result = await sendVendorConversationMessageAction(conversationId, text, !!uploaded);
    setSending(false);
    if (!result.ok) { toast.error(result.message); return; }

    const attachments: VendorConversationMessage["attachments"] = [];
    if (uploaded) {
      const attachResult = await addVendorConversationMessageAttachmentAction(result.messageId, uploaded);
      if (!attachResult.ok) toast.error(attachResult.message ?? "Message sent, but the attachment couldn't be saved.");
      else attachments.push({ id: result.messageId, fileUrl: uploaded.url, fileName: uploaded.name, fileSize: uploaded.size, mimeType: uploaded.mimeType });
    }

    setMessages((prev) => [...prev, {
      id: result.messageId, senderType: "vendor", body: text,
      sentAt: new Date().toISOString(), contactReadAt: null, venueReadAt: null,
      attachments,
    }]);
    setBody("");
    setPendingFile(null);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-card overflow-hidden ${showHeader ? "h-[calc(100vh-8rem)]" : "h-[480px]"}`}>
      {showHeader && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link href="/vendor/messages" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="text-sm font-medium text-foreground">Conversation</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => <Bubble key={m.id} msg={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3 space-y-2">
        {pendingFile && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs w-fit">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-[200px] truncate">{pendingFile.name}</span>
            {uploadingFile ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">Uploading…</span>
            ) : (
              <button type="button" onClick={() => setPendingFile(null)} aria-label="Remove attachment">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input ref={fileInputRef} type="file" onChange={handleFilePick} className="hidden" />
          <Button
            type="button" variant="outline" size="icon" disabled={sending || uploadingFile}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach a file" title="Attach a file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" disabled={(!body.trim() && !pendingFile) || sending || uploadingFile} onClick={() => void send()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

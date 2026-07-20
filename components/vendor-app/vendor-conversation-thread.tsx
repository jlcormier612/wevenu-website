"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { toast } from "sonner";

import { sendVendorConversationMessageAction } from "@/app/vendor/messages/actions";
import { Button } from "@/components/ui/button";
import type { VendorConversationMessage } from "@/lib/conversations/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
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
        <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
        <p className={`mt-1 text-[10px] ${isVendor ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {formatTime(msg.sentAt)}
        </p>
      </div>
    </div>
  );
}

export function VendorConversationThread({
  conversationId, initialMessages,
}: { conversationId: string; initialMessages: VendorConversationMessage[] }) {
  const [messages, setMessages] = React.useState(initialMessages);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const result = await sendVendorConversationMessageAction(conversationId, text);
    setSending(false);
    if (!result.ok) { toast.error(result.message); return; }
    setMessages((prev) => [...prev, {
      id: result.messageId, senderType: "vendor", body: text,
      sentAt: new Date().toISOString(), contactReadAt: null, venueReadAt: null,
    }]);
    setBody("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Link href="/vendor/messages" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-sm font-medium text-foreground">Conversation</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => <Bubble key={m.id} msg={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3 flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message…"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <Button type="button" size="sm" disabled={!body.trim() || sending} onClick={() => void send()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

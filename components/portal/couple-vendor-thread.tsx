"use client";

/**
 * Couple ↔ vendor portal thread — mirrors vendor-conversation-thread
 * patterns without redesigning the portal message UI.
 */

import * as React from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Msg = {
  id: string;
  senderType: string;
  body: string;
  sentAt: string;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function PortalCoupleVendorThread({
  token,
  clientId,
  conversationId,
  vendorName,
  onBack,
}: {
  token: string;
  clientId: string;
  conversationId: string;
  vendorName: string;
  onBack?: () => void;
}) {
  const [messages, setMessages] = React.useState<Msg[] | null>(null);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/portal/vendors/messages?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}&conversationId=${encodeURIComponent(conversationId)}`,
      );
      const data = await res.json() as { messages?: Msg[]; error?: string };
      if (cancelled) return;
      if (!res.ok || data.error) {
        toast.error("Could not load conversation.");
        setMessages([]);
        return;
      }
      setMessages(data.messages ?? []);
    })();
    return () => { cancelled = true; };
  }, [token, clientId, conversationId]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/portal/vendors/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, clientId, conversationId, body: text }),
      });
      const data = await res.json() as { ok?: boolean; message_id?: string; error?: string };
      if (!data.ok || !data.message_id) {
        toast.error(data.error ?? "Could not send message.");
        setSending(false);
        return;
      }
      setMessages((prev) => [
        ...(prev ?? []),
        {
          id: data.message_id!,
          senderType: "lead_or_client",
          body: text,
          sentAt: new Date().toISOString(),
        },
      ]);
      setBody("");
    } catch {
      toast.error("Could not send message.");
    }
    setSending(false);
  }

  return (
    <div className="flex h-[480px] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        {onBack && (
          <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{vendorName}</p>
          <p className="truncate text-xs text-muted-foreground">Your vendor team</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const isCouple = m.senderType === "lead_or_client";
            return (
              <div key={m.id} className={`flex ${isCouple ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    isCouple
                      ? "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm text-white"
                      : "max-w-[75%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground"
                  }
                  style={isCouple ? { background: "var(--venue-primary)" } : undefined}
                >
                  {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                  <p className={`mt-1 text-[10px] ${isCouple ? "opacity-70" : "text-muted-foreground"}`}>
                    {formatTime(m.sentAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex shrink-0 items-end gap-2 border-t border-border p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={`Message ${vendorName}…`}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--venue-primary)]"
        />
        <Button type="button" size="icon" onClick={() => void send()} disabled={sending || !body.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

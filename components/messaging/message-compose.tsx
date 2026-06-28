"use client";

import * as React from "react";

import { Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

import { sendMessageAction } from "@/app/(app)/messaging/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ComposeInput, MessageEntityType, SendResult } from "@/lib/messaging/types";

export function MessageCompose({
  entityType,
  entityId,
  defaultToEmail,
  defaultToName,
  prefillSubject,
  prefillBody,
  luvDraftId,
  onSent,
  onCancel,
}: {
  entityType: MessageEntityType;
  entityId: string;
  defaultToEmail: string;
  defaultToName: string;
  prefillSubject?: string;
  prefillBody?: string;
  luvDraftId?: string;
  onSent: (result: SendResult) => void;
  onCancel?: () => void;
}) {
  const [toEmail, setToEmail] = React.useState(defaultToEmail);
  const [subject, setSubject] = React.useState(prefillSubject ?? "");
  const [body, setBody] = React.useState(prefillBody ?? "");
  const [pending, startSend] = React.useTransition();

  function handleSend() {
    if (!toEmail.trim() || !subject.trim() || !body.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    startSend(async () => {
      const input: ComposeInput = { toEmail: toEmail.trim(), toName: defaultToName, subject: subject.trim(), body: body.trim(), luvDraftId };
      const result = await sendMessageAction(entityType, entityId, input);
      if (result.ok) {
        toast.success(`Message sent to ${toEmail}.`);
        onSent(result);
      } else {
        toast.error(result.message ?? "Could not send message.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-heading">New message</p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm border-b border-border pb-2">
          <span className="text-xs font-medium text-muted-foreground w-10">To</span>
          <input
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="recipient@email.com"
            className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-sm border-b border-border pb-2">
          <span className="text-xs font-medium text-muted-foreground w-10">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
          />
        </div>
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your message…"
        rows={8}
        className="font-sans text-sm leading-relaxed resize-none border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        autoFocus={!prefillBody}
      />

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {process.env.NEXT_PUBLIC_RESEND_CONFIGURED ? "Sends via Wevenu." : "Logged to your communication history."}
        </p>
        <Button type="button" size="sm" onClick={handleSend} disabled={pending || !toEmail || !subject || !body}>
          {pending
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</>
            : <><Send className="mr-1.5 h-3.5 w-3.5" />Send</>}
        </Button>
      </div>
    </div>
  );
}

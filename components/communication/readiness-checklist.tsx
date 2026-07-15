"use client";

/**
 * Communication Readiness — Communication Trust Experience, Phase 6.
 * "A venue should know before sending its first client message whether
 * everything is configured correctly" without ever needing to understand
 * email authentication — no SPF/DKIM/webhook language here.
 */
import * as React from "react";
import { Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { sendTestEmailAction, sendTestSmsAction, getCommunicationReadinessAction } from "@/app/(app)/messaging/actions";
import type { CommunicationReadiness, ReadinessState } from "@/lib/communication/readiness";

const STATE_META: Record<ReadinessState, { icon: string; className: string }> = {
  ready:     { icon: "✓", className: "text-success" },
  untested:  { icon: "○", className: "text-muted-foreground" },
  not_ready: { icon: "✕", className: "text-destructive" },
};

export function ReadinessChecklist({ initial }: { initial: CommunicationReadiness }) {
  const [readiness, setReadiness] = React.useState(initial);
  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [sendingSms, setSendingSms] = React.useState(false);

  async function refresh() {
    setReadiness(await getCommunicationReadinessAction());
  }

  async function testEmail() {
    setSendingEmail(true);
    const result = await sendTestEmailAction();
    if (result.ok) {
      toast.success(`Test email sent to ${readiness.venueEmail}.`);
      await refresh();
    } else {
      toast.error(result.message);
    }
    setSendingEmail(false);
  }

  async function testSms() {
    setSendingSms(true);
    const result = await sendTestSmsAction();
    if (result.ok) {
      toast.success(`Test text sent to ${readiness.venuePhone}.`);
      await refresh();
    } else {
      toast.error(result.message);
    }
    setSendingSms(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {readiness.allReady && <Check className="h-4 w-4 text-success" aria-hidden />}
          <h2 className="font-heading text-sm font-semibold text-heading">
            {readiness.allReady ? "Communication Ready" : "Communication Readiness"}
          </h2>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <ul className="space-y-2">
          {readiness.items.map((item) => {
            const meta = STATE_META[item.state];
            return (
              <li key={item.key} className="flex items-start gap-2 text-sm">
                <span className={`font-semibold ${meta.className}`} aria-hidden>{meta.icon}</span>
                <div className="min-w-0">
                  <p className="text-heading">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <button
            type="button" onClick={() => void testEmail()} disabled={sendingEmail || !readiness.venueEmail}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-heading hover:bg-muted disabled:opacity-40"
          >
            {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send test email
          </button>
          <button
            type="button" onClick={() => void testSms()} disabled={sendingSms || !readiness.venuePhone}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-heading hover:bg-muted disabled:opacity-40"
          >
            {sendingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send test text
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

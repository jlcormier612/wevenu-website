"use client";

/**
 * Communication Readiness — Communication Trust Experience, Phase 6.
 * "A venue should know before sending its first client message whether
 * everything is configured correctly" without ever needing to understand
 * email authentication — no SPF/DKIM/webhook language here.
 */
import * as React from "react";
import Link from "next/link";
import { Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { sendTestEmailAction, sendTestSmsAction, getCommunicationReadinessAction } from "@/app/(app)/messaging/actions";
import type { CommunicationReadiness, ReadinessState } from "@/lib/communication/readiness-types";
import {
  EMAIL_ENGAGEMENT_NOTE,
  MESSAGE_STATUS_DEFINITIONS,
} from "@/lib/communication/message-status-definitions";
import {
  isEmailTestActionAvailable,
  isSmsTestActionAvailable,
} from "@/lib/communication/test-send";
import { TEXTING_SETUP_PATH } from "@/lib/texting-registration/types";

const STATE_META: Record<ReadinessState, { icon: string; className: string }> = {
  ready:     { icon: "✓", className: "text-success" },
  untested:  { icon: "○", className: "text-muted-foreground" },
  not_ready: { icon: "✕", className: "text-destructive" },
};

export function ReadinessChecklist({ initial }: { initial: CommunicationReadiness }) {
  const [readiness, setReadiness] = React.useState(initial);
  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [sendingSms, setSendingSms] = React.useState(false);
  const [actionFeedback, setActionFeedback] = React.useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const emailAvailable = isEmailTestActionAvailable({
    emailConfigured: readiness.emailConfigured,
    venueEmail: readiness.venueEmail,
  });
  const smsAvailable = isSmsTestActionAvailable({
    smsConfigured: readiness.smsConfigured,
    venuePhone: readiness.venuePhone,
  });

  async function refresh() {
    setReadiness(await getCommunicationReadinessAction());
  }

  async function testEmail() {
    if (sendingEmail || !emailAvailable) return;
    setSendingEmail(true);
    setActionFeedback(null);
    try {
      const result = await sendTestEmailAction();
      if (result.ok) {
        toast.success(result.message);
        setActionFeedback({ tone: "success", message: result.message });
        await refresh();
      } else {
        toast.error(result.message);
        setActionFeedback({ tone: "error", message: result.message });
      }
    } catch {
      const message = "Could not send the test email. Try again.";
      toast.error(message);
      setActionFeedback({ tone: "error", message });
    } finally {
      setSendingEmail(false);
    }
  }

  async function testSms() {
    if (sendingSms || !smsAvailable) return;
    setSendingSms(true);
    setActionFeedback(null);
    try {
      const result = await sendTestSmsAction();
      if (result.ok) {
        toast.success(result.message);
        setActionFeedback({ tone: "success", message: result.message });
        await refresh();
      } else {
        toast.error(result.message);
        setActionFeedback({ tone: "error", message: result.message });
      }
    } catch {
      const message = "Could not send the test text. Try again.";
      toast.error(message);
      setActionFeedback({ tone: "error", message });
    } finally {
      setSendingSms(false);
    }
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
        <p className="text-xs text-muted-foreground">
          Email and texting readiness is shown here before you send from Inbox. Portal messages and internal notes do not need this checklist.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-heading">Setup</p>
            <ul className="space-y-2">
              {readiness.items.map((item) => {
                const meta = STATE_META[item.state];
                return (
                  <li key={item.key} className="flex items-start gap-2 text-sm">
                    <span className={`font-semibold ${meta.className}`} aria-hidden>{meta.icon}</span>
                    <div className="min-w-0">
                      <p className="text-heading">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                      {item.key === "sms" && item.state === "not_ready" && (
                        <p className="text-xs mt-1">
                          <Link
                            href={TEXTING_SETUP_PATH}
                            className="underline underline-offset-2 text-heading hover:text-foreground"
                          >
                            Enable text messaging
                          </Link>
                          {" "}in Settings → Communications.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="min-w-0 space-y-2 md:border-l md:border-border/60 md:pl-8">
            <p className="text-xs font-medium text-heading">Message statuses</p>
            <ul className="space-y-2.5">
              {MESSAGE_STATUS_DEFINITIONS.map((def) => (
                <li key={def.key} className="text-sm">
                  <p className="font-medium text-heading">{def.label}</p>
                  <p className="text-xs text-muted-foreground">{def.definition}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-1">{EMAIL_ENGAGEMENT_NOTE}</p>
          </div>
        </div>

        <div className="border-t border-border/60 pt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void testEmail()}
              disabled={sendingEmail || !emailAvailable}
              aria-busy={sendingEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-heading hover:bg-muted disabled:opacity-40"
            >
              {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sendingEmail ? "Sending test email…" : "Send test email"}
            </button>
            <button
              type="button"
              onClick={() => void testSms()}
              disabled={sendingSms || !smsAvailable}
              aria-busy={sendingSms}
              title={
                !readiness.smsConfigured
                  ? "Enable text messaging in Settings → Communications first"
                  : !readiness.venuePhone
                    ? "Add a venue phone number in Settings first"
                    : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-heading hover:bg-muted disabled:opacity-40"
            >
              {sendingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sendingSms ? "Sending test text…" : "Send test text"}
            </button>
          </div>
          {!readiness.smsConfigured && (
            <p className="text-xs text-muted-foreground">
              Send test text stays unavailable until texting is enabled in{" "}
              <Link href={TEXTING_SETUP_PATH} className="underline underline-offset-2 text-heading hover:text-foreground">
                Settings → Communications
              </Link>
              . Hello to Cheers will not call the texting provider while texting is off.
            </p>
          )}
          {actionFeedback && (
            <p
              role="status"
              className={
                actionFeedback.tone === "success"
                  ? "text-xs text-success"
                  : "text-xs text-destructive"
              }
            >
              {actionFeedback.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

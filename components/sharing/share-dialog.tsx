"use client";

/**
 * Work Package D5E — the one shared "Share" experience. Every business
 * asset (Contract, Questionnaire, Event Order, …) already has its own real
 * send/share function with its own domain rules (D2/D4/D5A/D5C/D5D). This
 * component is only the presentation layer around that: it shows who's
 * receiving it, explains what happens next in the asset's own words, lets
 * the venue adjust the message, and reports what happened. It contains no
 * `if (assetType === …)` branching — the caller supplies everything
 * asset-specific (recipient, explanation text, default message, and the
 * actual send function); this file only renders it and manages the
 * send/success/error/stale-recipient states common to all of them (Steps
 * 56–58 of the brief: shared UI, not shared business logic).
 *
 * Deliberately built on the existing Sheet primitive — the one dialog-style
 * surface already used throughout this app (Template sheets, item sheets,
 * etc.) — not a new modal system.
 */

import * as React from "react";

import { CheckCircle2, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

export type ShareRecipient = {
  name: string;
  /** Email or other contact string. Null means "we don't actually have a way to reach them yet." */
  contact: string | null;
  /** e.g. "Client", "Photographer" — shown for extra certainty, never an internal id/role code. */
  relationshipLabel?: string | null;
};

export type ShareDialogProps = {
  /** The element that opens the sheet — e.g. <Button>Share with Client</Button>. */
  trigger: React.ReactElement;
  /** Sheet title — e.g. "Share Contract", "Send Questionnaire". Plain, customer-facing. */
  title: string;
  recipient: ShareRecipient | null;
  /** One sentence, in the recipient's shoes — e.g. "They'll review and sign the contract." */
  whatHappensNext: string;
  /** Pre-filled, editable, already merge-resolved (caller ran mergeContent()). */
  defaultMessage: string;
  /** Label on the send button — "Send" by default, "Resend" for a resend flow. */
  sendLabel?: string;
  /** The asset's own real send function. Message is the (possibly-edited) body text. */
  onSend: (message: string) => Promise<{ ok: boolean; message?: string; cancelled?: boolean }>;
  /** Called once the send genuinely succeeds — e.g. router.refresh(). */
  onSent?: () => void;
};

type State = "idle" | "sending" | "success" | "error";

export function ShareDialog({ trigger, title, recipient, whatHappensNext, defaultMessage, sendLabel = "Send", onSend, onSent }: ShareDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState(defaultMessage);
  const [state, setState] = React.useState<State>("idle");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) { setMessage(defaultMessage); setState("idle"); setError(""); }
  }, [open, defaultMessage]);

  const canSend = state !== "sending" && !!recipient?.contact;

  function handleSend() {
    if (!canSend) return;
    setState("sending");
    setError("");
    void onSend(message).then((result) => {
      if (result.ok) {
        setState("success");
        onSent?.();
      } else if (result.cancelled) {
        setState("idle");
      } else {
        setState("error");
        setError(result.message ?? "Couldn't send. Please try again.");
      }
    }).catch(() => {
      setState("error");
      setError("Couldn't send. Please try again.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        {state === "success" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm font-medium text-heading">Sent to {recipient?.name}.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Recipient safety (Step 6) — never ambiguous, never an internal id. */}
            <div className="rounded-sm border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Sending to</p>
              {recipient ? (
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading truncate">
                      {recipient.name}
                      {recipient.relationshipLabel && <span className="ml-1.5 font-normal text-muted-foreground">· {recipient.relationshipLabel}</span>}
                    </p>
                    {recipient.contact ? (
                      <p className="text-xs text-muted-foreground truncate">{recipient.contact}</p>
                    ) : (
                      <p className="text-xs text-destructive">No email on file — add one to their contact record first.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-destructive">No recipient found for this event yet.</p>
              )}
            </div>

            {/* Step 8 — what happens next, in plain language, never a technical action selector. */}
            <p className="text-sm text-foreground">{whatHappensNext}</p>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-heading">Message</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} disabled={state === "sending"} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={state === "sending"}>Cancel</Button>
              <Button type="button" disabled={!canSend} onClick={handleSend}>
                {state === "sending" ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Sending…</> : sendLabel}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

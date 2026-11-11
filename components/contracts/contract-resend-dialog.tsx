"use client";

/**
 * Contract resend — explicit recipient selection for every required signatory.
 * Selection is enforced server-side via signer ids (never arbitrary emails).
 */

import * as React from "react";

import { CheckCircle2, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultResendSelection,
  listResendRecipients,
  type ResendDeliveryOutcome,
  type ResendRecipientView,
} from "@/lib/contracts/resend-recipients";
import type { ContractSigner } from "@/lib/contracts/signers";

export type ContractResendDialogProps = {
  trigger: React.ReactElement;
  title?: string;
  signers: ContractSigner[];
  defaultMessage: string;
  onResend: (
    message: string,
    signerIds: string[],
  ) => Promise<{ ok: boolean; message?: string; deliveries?: ResendDeliveryOutcome[] }>;
  onSent?: () => void;
};

type State = "idle" | "sending" | "success" | "error";

export function ContractResendDialog({
  trigger,
  title = "Resend Contract",
  signers,
  defaultMessage,
  onResend,
  onSent,
}: ContractResendDialogProps) {
  const recipients = React.useMemo(() => listResendRecipients(signers), [signers]);
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState(defaultMessage);
  const [selected, setSelected] = React.useState<string[]>(() => defaultResendSelection(recipients));
  const [state, setState] = React.useState<State>("idle");
  const [error, setError] = React.useState("");
  const [resultMessage, setResultMessage] = React.useState("");
  const [deliveries, setDeliveries] = React.useState<ResendDeliveryOutcome[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setMessage(defaultMessage);
    setSelected(defaultResendSelection(recipients));
    setState("idle");
    setError("");
    setResultMessage("");
    setDeliveries([]);
  }, [open, defaultMessage, recipients]);

  const canSend = state !== "sending" && selected.length > 0;

  function toggle(signerId: string, checked: boolean) {
    setSelected((current) => {
      if (checked) return current.includes(signerId) ? current : [...current, signerId];
      return current.filter((id) => id !== signerId);
    });
  }

  function handleSend() {
    if (!canSend) return;
    setState("sending");
    setError("");
    void onResend(message, selected).then((result) => {
      if (result.ok) {
        setState("success");
        setResultMessage(result.message ?? "Sent.");
        setDeliveries(result.deliveries ?? []);
        onSent?.();
      } else {
        setState("error");
        setError(result.message ?? "Couldn't send. Please try again.");
        setDeliveries(result.deliveries ?? []);
      }
    }).catch(() => {
      setState("error");
      setError("Couldn't send. Please try again.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        {state === "success" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm font-medium text-heading">{resultMessage}</p>
            {deliveries.length > 0 ? (
              <ul className="w-full space-y-1 text-left text-xs text-muted-foreground">
                {deliveries.map((d) => (
                  <li key={d.signerId}>
                    {d.name}
                    {d.email ? ` · ${d.email}` : ""} — {d.status}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Provider acceptance confirms the message was accepted for delivery, not that it reached an inbox.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recipients
              </p>
              <p className="text-sm text-foreground">
                Choose who should receive another copy of their signing link. Resending does not change
                the contract or its signing requirements.
              </p>
              {recipients.length === 0 ? (
                <p className="text-sm text-destructive">No required signatories found on this contract.</p>
              ) : (
                <ul className="space-y-3" data-testid="contract-resend-recipients">
                  {recipients.map((r) => (
                    <RecipientRow
                      key={r.signerId}
                      recipient={r}
                      checked={selected.includes(r.signerId)}
                      disabled={state === "sending"}
                      onCheckedChange={(checked) => toggle(r.signerId, checked)}
                    />
                  ))}
                </ul>
              )}
              {selected.length === 0 ? (
                <p className="text-xs text-destructive">Select at least one recipient to resend.</p>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="contract-resend-selection-summary">
                  Sending to {selected.length} of {recipients.length}{" "}
                  {recipients.length === 1 ? "signatory" : "signatories"}.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-heading" htmlFor="contract-resend-message">
                Message
              </label>
              <Textarea
                id="contract-resend-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                disabled={state === "sending"}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {state === "error" && deliveries.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {deliveries.map((d) => (
                  <li key={d.signerId}>
                    {d.name}: {d.status}
                    {d.message ? ` — ${d.message}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={state === "sending"}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canSend}
                onClick={handleSend}
                data-testid="contract-resend-submit"
              >
                {state === "sending" ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Sending…</>
                ) : (
                  "Resend"
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RecipientRow({
  recipient,
  checked,
  disabled,
  onCheckedChange,
}: {
  recipient: ResendRecipientView;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = `resend-signer-${recipient.signerId}`;
  return (
    <li className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
        data-testid={`contract-resend-check-${recipient.signerId}`}
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-heading break-words">
              {recipient.name}
              {recipient.roleLabel ? (
                <span className="ml-1.5 font-normal text-muted-foreground">· {recipient.roleLabel}</span>
              ) : null}
              {recipient.alreadySigned ? (
                <span className="ml-1.5 font-normal text-muted-foreground">(already signed)</span>
              ) : null}
            </p>
            {recipient.email ? (
              <p className="text-xs text-muted-foreground break-all">{recipient.email}</p>
            ) : (
              <p className="text-xs text-destructive">No email on file</p>
            )}
          </div>
        </div>
      </label>
    </li>
  );
}

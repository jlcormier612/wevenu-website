"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setupPaymentsAction } from "@/app/(app)/booking-journey/payments-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { remainingAmount } from "@/lib/commercial-selections/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { formatCurrency } from "@/lib/invoices/constants";
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import {
  applyCustomScheduleToTotal,
  type CustomScheduleTemplate,
} from "@/lib/payments/custom-default-schedule";

export function SetupPaymentsSheet({
  open,
  onOpenChange,
  selection,
  clientId,
  eventId,
  eventDate,
  leadId,
  spaceId,
  defaultScheduleStructure = "deposit_remaining",
  paymentCollection = "either",
  customSchedule = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: CommercialSelection;
  clientId?: string;
  eventId?: string;
  /** YYYY-MM-DD — when present, used as remaining-balance due date. */
  eventDate?: string | null;
  leadId?: string;
  spaceId?: string;
  defaultScheduleStructure?: string;
  paymentCollection?: "online" | "external" | "either";
  customSchedule?: CustomScheduleTemplate | null;
}) {
  // Remount body when opening so step/deposit reset without an effect.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SetupPaymentsSheetBody
          key={`${selection.id}:${selection.depositAmount}:${eventDate ?? ""}:${defaultScheduleStructure}`}
          onOpenChange={onOpenChange}
          selection={selection}
          clientId={clientId}
          eventId={eventId}
          eventDate={eventDate}
          leadId={leadId}
          spaceId={spaceId}
          defaultScheduleStructure={defaultScheduleStructure}
          paymentCollection={paymentCollection}
          customSchedule={customSchedule}
        />
      ) : null}
    </Sheet>
  );
}

function SetupPaymentsSheetBody({
  onOpenChange,
  selection,
  clientId,
  eventId,
  eventDate,
  leadId,
  spaceId,
  defaultScheduleStructure,
  paymentCollection,
  customSchedule,
}: {
  onOpenChange: (open: boolean) => void;
  selection: CommercialSelection;
  clientId?: string;
  eventId?: string;
  eventDate?: string | null;
  leadId?: string;
  spaceId?: string;
  defaultScheduleStructure: string;
  paymentCollection: "online" | "external" | "either";
  customSchedule: CustomScheduleTemplate | null;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [deposit, setDeposit] = React.useState(String(selection.depositAmount));
  const [remainingDueDate, setRemainingDueDate] = React.useState(eventDate ?? "");
  const [scheduleStructure, setScheduleStructure] = React.useState(defaultScheduleStructure);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState("");

  const isFull = scheduleStructure === "full";
  const isCustom = scheduleStructure === "custom";
  const depositAmount = isFull
    ? selection.totalAmount
    : parseFloat(deposit.replace(/[$,]/g, "")) || 0;
  const remaining = remainingAmount(selection.totalAmount, depositAmount);
  const needsRemainingDue = !isCustom && remaining > 0;
  const hasEventDue = Boolean(eventDate);

  const customPreview =
    isCustom && customSchedule
      ? applyCustomScheduleToTotal({
          template: customSchedule,
          total: selection.totalAmount,
          today: new Date().toISOString().slice(0, 10),
          eventDate: eventDate ?? (remainingDueDate || null),
          remainingDueDate: remainingDueDate || null,
        })
      : null;

  function create(requestDeposit: boolean) {
    if (isCustom && !customSchedule) {
      setError("Configure a Custom payment schedule in Settings first.");
      return;
    }
    if (!isCustom && (!(depositAmount >= 0) || depositAmount > selection.totalAmount)) {
      setError("Enter a valid deposit amount.");
      return;
    }
    if (needsRemainingDue && !hasEventDue && !remainingDueDate.trim()) {
      setError("Set a due date for the remaining balance.");
      setStep(2);
      return;
    }
    if (isCustom && customPreview && !customPreview.ok) {
      setError(customPreview.message);
      setStep(2);
      return;
    }
    startTransition(async () => {
      const result = await setupPaymentsAction({
        selectionId: selection.id,
        clientId,
        eventId,
        eventDate: eventDate ?? undefined,
        remainingDueDate: needsRemainingDue && !hasEventDue ? remainingDueDate : (isCustom && !hasEventDue ? remainingDueDate : undefined),
        leadId,
        spaceId,
        depositAmount: isCustom ? undefined : depositAmount,
        requestDeposit,
        scheduleStructure,
        customSchedule: isCustom ? customSchedule : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(
        requestDeposit
          ? result.emailSent
            ? "Payments set up — deposit request emailed."
            : "Payments set up — deposit marked ready. Send the invoice if email wasn't delivered."
          : "Payments set up.",
      );
      onOpenChange(false);
      router.push(`/invoices/${result.invoiceId}`);
      router.refresh();
    });
  }

  return (
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader className="mb-6">
        <SheetTitle>Set up payments</SheetTitle>
        <p className="text-sm text-muted-foreground">
          Step {step} of 3 — create the {formatCurrency(selection.totalAmount)} commitment and
          collect the deposit.
        </p>
      </SheetHeader>

      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Commitment</p>
            <p className="mt-1 text-base font-medium text-heading">{selection.name}</p>
            <p className="text-lg font-semibold text-heading">{formatCurrency(selection.totalAmount)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Invoice line preview</p>
            <p className="text-sm text-heading">
              1 × {selection.name} — {formatCurrency(selection.totalAmount)}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isCustom
              ? "Your Custom schedule from Settings will create the payment plan for this booking total."
              : "Couples usually pay the deposit now. The rest stays on the payment plan."}
          </p>
          <div className="space-y-2">
            <Label>Payment structure</Label>
            <Select value={scheduleStructure} onValueChange={setScheduleStructure}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit_remaining">Deposit + final balance</SelectItem>
                <SelectItem value="full">Full payment now</SelectItem>
                {SCHEDULE_PRESETS.filter((p) => p.items.length > 1).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
                {customSchedule ? (
                  <SelectItem value="custom">Custom (venue default)</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          {isCustom ? (
            <div className="space-y-2">
              {customPreview?.ok ? (
                <div className="rounded-lg border border-border px-4 py-3 text-sm space-y-1">
                  {customPreview.lines.map((line) => (
                    <p key={`${line.label}-${line.dueDate}`}>
                      {line.label}: <strong>{formatCurrency(line.amount)}</strong>
                      <span className="text-muted-foreground"> · due {line.dueDate}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-destructive">
                  {customPreview && !customPreview.ok
                    ? customPreview.message
                    : "Configure a Custom schedule in Settings first."}
                </p>
              )}
              {!hasEventDue ? (
                <div className="space-y-2">
                  <Label htmlFor="setup-remaining-due">Event / schedule anchor date</Label>
                  <Input
                    id="setup-remaining-due"
                    type="date"
                    value={remainingDueDate}
                    onChange={(e) => {
                      setRemainingDueDate(e.target.value);
                      setError("");
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Needed for installments due before the event.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Event date — {eventDate}</p>
              )}
            </div>
          ) : (
            <>
              {!isFull && (
                <div className="space-y-2">
                  <Label htmlFor="setup-deposit">Deposit</Label>
                  <Input
                    id="setup-deposit"
                    value={deposit}
                    onChange={(e) => {
                      setDeposit(e.target.value);
                      setError("");
                    }}
                    inputMode="decimal"
                  />
                  <p className="text-xs text-muted-foreground">Deposit is due today.</p>
                </div>
              )}
              {needsRemainingDue && (
                <div className="space-y-2">
                  <Label htmlFor="setup-remaining-due">Remaining balance due date</Label>
                  {hasEventDue ? (
                    <p className="text-sm text-heading">
                      Event date — {eventDate}
                    </p>
                  ) : (
                    <Input
                      id="setup-remaining-due"
                      type="date"
                      value={remainingDueDate}
                      onChange={(e) => {
                        setRemainingDueDate(e.target.value);
                        setError("");
                      }}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {hasEventDue
                      ? "Remaining balance is due on the event date (installment dates may land earlier)."
                      : "Required when there is no event date yet."}
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-border px-4 py-3 text-sm">
                <p>Deposit: <strong>{formatCurrency(depositAmount)}</strong> (due today)</p>
                <p className="mt-1">Remaining balance: <strong>{formatCurrency(remaining)}</strong></p>
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-2">
            <p><strong>{selection.name}</strong> — {formatCurrency(selection.totalAmount)}</p>
            {isCustom && customPreview?.ok ? (
              customPreview.lines.map((line) => (
                <p key={`${line.label}-${line.dueDate}`}>
                  {line.label}: {formatCurrency(line.amount)} · due {line.dueDate}
                </p>
              ))
            ) : (
              <>
                <p>Deposit {formatCurrency(depositAmount)} (due today) · Remaining {formatCurrency(remaining)}</p>
                {needsRemainingDue && (
                  <p className="text-xs text-muted-foreground">
                    Remaining due {hasEventDue ? eventDate : remainingDueDate || "—"}
                  </p>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Creates one invoice and one payment schedule. Existing Library package prices are not changed.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col gap-2">
            {paymentCollection !== "external" && (
              <Button type="button" onClick={() => create(true)} disabled={pending}>
                {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : "Create & request deposit"}
              </Button>
            )}
            <Button
              type="button"
              variant={paymentCollection === "external" ? "default" : "outline"}
              onClick={() => create(false)}
              disabled={pending}
            >
              {paymentCollection === "external" ? "Create schedule (record payment next)" : "Create only"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={pending}>
              Back
            </Button>
          </div>
        </div>
      )}
    </SheetContent>
  );
}

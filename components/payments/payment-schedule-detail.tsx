"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Check,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { celebrateLuv } from "@/lib/luv/celebrate";
import { coordinatorCelebrationMessage } from "@/lib/luv/celebrations";

import {
  addLineItemAction,
  cancelItemAction,
  deleteItemAction,
  markPaidAction,
  refundItemAction,
  updateLineItemAction,
} from "@/app/(app)/payments/[id]/actions";
import {
  PaymentStatusBadge,
  ScheduleStatusBadge,
} from "@/components/payments/payment-status-badge";
import { ScheduleReviewBanner } from "@/components/payments/schedule-review-banner";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { QuickBooksSyncStatusBadge } from "@/components/quickbooks/sync-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  PAYMENT_METHODS,
  OBLIGATION_KIND_OPTIONS,
  computeTotalPaid,
  daysUntil,
  formatDate,
  formatMoney,
  paymentMethodLabel,
  paymentPlanReviewStatus,
} from "@/lib/payments/constants";
import type {
  LineItemInput,
  MarkPaidInput,
  PaymentLineItem,
  PaymentObligationKind,
  PaymentScheduleWithDetails,
} from "@/lib/payments/types";
import type { Invoice } from "@/lib/invoices/types";
import { formatCurrency } from "@/lib/invoices/constants";
import { cn } from "@/lib/utils";

// ---- Inline add/edit form ---------------------------------------------------

function LineItemForm({
  initial,
  onSave,
  onCancel,
  pending,
  submitLabel,
  requireKind = true,
}: {
  initial: LineItemInput;
  onSave: (input: LineItemInput) => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  /** Creates require an explicit kind; edits may keep the stored value. */
  requireKind?: boolean;
}) {
  const [label, setLabel] = React.useState(initial.label);
  const [amount, setAmount] = React.useState(initial.amount);
  const [dueDate, setDueDate] = React.useState(initial.dueDate);
  const [obligationKind, setObligationKind] = React.useState<PaymentObligationKind | "">(
    initial.obligationKind ?? "",
  );

  // Listen for "Fill remaining balance" events from the parent
  React.useEffect(() => {
    function handler(e: Event) {
      const value = (e as CustomEvent<string>).detail;
      setAmount(value);
    }
    window.addEventListener("fill-remaining", handler);
    return () => window.removeEventListener("fill-remaining", handler);
  }, []);

  const kindReady = !requireKind || Boolean(obligationKind);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-end rounded-lg border border-ring bg-card p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Deposit, Final Payment…" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Kind *</Label>
        <Select
          value={obligationKind || "__none__"}
          onValueChange={(v) => setObligationKind(v === "__none__" ? "" : v as PaymentObligationKind)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {!requireKind && <SelectItem value="__none__">Keep current</SelectItem>}
            {OBLIGATION_KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Amount</Label>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5,000" className="w-28" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Due date</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-36" />
      </div>
      <div className="flex items-center gap-1.5 sm:col-span-4 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button
          type="button"
          size="sm"
          disabled={!label.trim() || !amount.trim() || !kindReady || pending}
          onClick={() => onSave({
            label,
            amount,
            dueDate,
            ...(obligationKind ? { obligationKind } : {}),
          })}
        >
          <Check className="mr-1 h-3.5 w-3.5" />{pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ---- Mark as Paid form ------------------------------------------------------

function MarkPaidForm({
  item,
  onSave,
  onCancel,
  pending,
}: {
  item: PaymentLineItem;
  onSave: (input: MarkPaidInput) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [paidAmount, setPaidAmount] = React.useState(String(item.amount));
  const [method, setMethod] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [paidDate, setPaidDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");
  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-3">
      <p className="text-sm font-medium text-heading">Record Payment</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Amount received *</Label>
          <Input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date received *</Label>
          <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Payment method</Label>
          <Select value={method} onValueChange={setMethod} items={PAYMENT_METHODS}>
            <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Reference # <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Check #, transaction ID…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any notes about this payment…" />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!paidAmount.trim() || !paidDate || pending}
          onClick={() => onSave({ paidAmount, paymentMethod: method, referenceNumber: ref, paidDate, notes })}>
          {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Recording…</> : "Record Payment"}
        </Button>
      </div>
    </div>
  );
}

// ---- Refund form -------------------------------------------------------------

function RefundForm({
  item,
  onSave,
  onCancel,
  pending,
}: {
  item: PaymentLineItem;
  onSave: (amount: number, reason: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const collected = item.paidAmount ?? item.amount;
  const refundable = collected - (item.refundedAmount ?? 0);
  const [amount, setAmount] = React.useState(String(refundable));
  const [reason, setReason] = React.useState("");
  const parsed = parseFloat(amount);
  const valid = !Number.isNaN(parsed) && parsed > 0 && parsed <= refundable + 0.001;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-medium text-heading">Issue Refund</p>
      <p className="text-xs text-muted-foreground">
        Up to {formatMoney(refundable)} can be refunded on this payment.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Refund amount *</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-invalid={!valid} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cancellation, overpayment…" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" variant="destructive" disabled={!valid || pending}
          onClick={() => onSave(parsed, reason)}>
          {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Refunding…</> : "Issue Refund"}
        </Button>
      </div>
    </div>
  );
}

// ---- Single line item row ---------------------------------------------------

function LineItemRow({
  item,
  scheduleId,
  scheduleTitle,
  onUpdate,
  onMarkPaid,
  onDelete,
  currentUserRole,
}: {
  item: PaymentLineItem;
  scheduleId: string;
  scheduleTitle: string;
  onUpdate: (id: string, updated: Partial<PaymentLineItem>) => void;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void;
  currentUserRole?: string | null;
}) {
  const [editMode, setEditMode] = React.useState(false);
  const [payMode, setPayMode] = React.useState(false);
  const [refundMode, setRefundMode] = React.useState(false);
  const [editPending, startEdit] = React.useTransition();
  const [payPending, startPay] = React.useTransition();
  const [cancelPending, startCancel] = React.useTransition();
  const [refundPending, startRefund] = React.useTransition();

  const days = item.dueDate ? daysUntil(item.dueDate) : null;
  const isPaid = item.status === "paid";
  const isCancelled = item.status === "cancelled";
  const isRefunded = item.status === "refunded";
  const isPartiallyRefunded = item.status === "partially_refunded";
  // Stripe Connect (Sprint 4) — an ACH debit that's been initiated but
  // hasn't settled yet (4-5 business days). Stripe owns this state; a
  // coordinator can't manually intervene while it's in flight.
  const isProcessing = item.status === "processing";
  // TR-M3: refunds are Owner-only server-side (and RLS-backed, TR-G5) — this
  // mirrors that here so a Manager/Coordinator/Staff never sees a button
  // that the server was always going to reject. Cosmetic-only: the real
  // enforcement remains server-side, unchanged by this.
  const canRefund = (isPaid || isPartiallyRefunded) && currentUserRole === "owner";

  function handleEdit(input: LineItemInput) {
    startEdit(async () => {
      const result = await updateLineItemAction(item.id, scheduleId, input);
      if (result.ok) {
        onUpdate(item.id, {
          label: input.label.trim(),
          amount: parseFloat(input.amount),
          dueDate: input.dueDate || null,
          ...(input.obligationKind ? { obligationKind: input.obligationKind } : {}),
        });
        setEditMode(false);
      } else toast.error(result.message ?? "Could not save.");
    });
  }

  function handleMarkPaid(input: MarkPaidInput) {
    startPay(async () => {
      const result = await markPaidAction(item.id, scheduleId, input);
      if (result.ok) {
        onMarkPaid(item.id);
        setPayMode(false);
        if (result.celebrated) {
          celebrateLuv(coordinatorCelebrationMessage("final_payment_received", scheduleTitle));
        } else if (result.obligationCelebrated) {
          celebrateLuv(coordinatorCelebrationMessage("final_payment_obligation_paid", scheduleTitle));
        } else {
          toast.success("Payment recorded.");
        }
      } else toast.error(result.message ?? "Could not record payment.");
    });
  }

  function handleRefund(amount: number, reason: string) {
    startRefund(async () => {
      const result = await refundItemAction(item.id, scheduleId, amount, reason);
      if (result.ok) {
        const collected = item.paidAmount ?? item.amount;
        const newRefundedAmount = (item.refundedAmount ?? 0) + amount;
        onUpdate(item.id, {
          status: newRefundedAmount >= collected - 0.001 ? "refunded" : "partially_refunded",
          refundedAmount: newRefundedAmount,
        });
        setRefundMode(false);
        toast.success("Refund recorded.");
      } else toast.error(result.message ?? "Could not issue refund.");
    });
  }

  async function handleCancel() {
    startCancel(async () => {
      const result = await cancelItemAction(item.id, scheduleId);
      if (result.ok) onUpdate(item.id, { status: "cancelled" });
      else toast.error(result.message);
    });
  }

  if (editMode) {
    return (
      <LineItemForm
        initial={{
          label: item.label,
          amount: String(item.amount),
          dueDate: item.dueDate ?? "",
          obligationKind: item.obligationKind ?? undefined,
        }}
        onSave={handleEdit}
        onCancel={() => setEditMode(false)}
        pending={editPending}
        submitLabel="Save"
        requireKind={false}
      />
    );
  }

  return (
    <div>
      <div className={cn("group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
        isRefunded || isPartiallyRefunded ? "border-amber-300/50 bg-amber-50 dark:bg-amber-950/20"
          : isPaid ? "border-success/20 bg-success/5" : isCancelled ? "border-border opacity-50"
          : isProcessing ? "border-blue-300/50 bg-blue-50 dark:bg-blue-950/20"
          : item.status === "overdue" ? "border-destructive/20 bg-destructive/5" : "border-border")}>
        {/* Status icon */}
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
          isRefunded || isPartiallyRefunded ? "border-amber-500 bg-amber-500 text-white"
            : isPaid ? "border-success bg-success text-white"
            : isProcessing ? "border-blue-500 text-blue-500"
            : item.status === "overdue" ? "border-destructive text-destructive" : "border-border text-muted-foreground")}>
          {isPaid || isRefunded || isPartiallyRefunded ? <Check className="h-3.5 w-3.5" /> : isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : item.status === "overdue" ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className={cn("text-sm font-medium", isPaid ? "text-foreground" : isCancelled ? "line-through text-muted-foreground" : "text-foreground")}>
            {item.label}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{formatMoney(item.amount)}</span>
            {item.dueDate && (
              <>
                <span className="text-border">·</span>
                <span className={item.status === "overdue" ? "font-medium text-destructive" : ""}>
                  {item.status === "overdue" && "Overdue · "}
                  {days === 0 ? "Due today" : days != null && days > 0 ? `Due in ${days} days` : ""}
                  {days != null && days < 0 && !isPaid ? `${Math.abs(days)} days past due` : ""}
                  {isPaid || days == null ? "" : ""}{formatDate(item.dueDate)}
                </span>
              </>
            )}
            {isPaid && item.paidAt && (
              <><span className="text-border">·</span><span className="text-success">Paid {formatDate(item.paidAt.slice(0, 10))}{item.paidAmount != null && item.paidAmount !== item.amount ? ` (${formatMoney(item.paidAmount)})` : ""}</span></>
            )}
            {isPaid && item.paymentMethod && (
              <><span className="text-border">·</span><span>{paymentMethodLabel(item.paymentMethod)}</span></>
            )}
            {isProcessing && (
              <><span className="text-border">·</span><span className="font-medium text-blue-600 dark:text-blue-400">Processing — ACH transfer initiated, funds arrive in 4–5 business days</span></>
            )}
            {(isRefunded || isPartiallyRefunded) && item.refundedAt && (
              <>
                <span className="text-border">·</span>
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {isRefunded ? "Fully refunded" : "Partially refunded"} {formatMoney(item.refundedAmount)} on {formatDate(item.refundedAt.slice(0, 10))}
                </span>
              </>
            )}
            {item.refundReason && (
              <><span className="text-border">·</span><span>{item.refundReason}</span></>
            )}
          </div>
          {(isPaid || isRefunded || isPartiallyRefunded) && (
            <QuickBooksSyncStatusBadge
              status={item.quickbooksSyncStatus}
              entityType={isRefunded || isPartiallyRefunded ? "refund" : "payment"}
              entityId={item.id}
            />
          )}
        </div>

        {/* Actions */}
        {!isPaid && !isCancelled && !isRefunded && !isPartiallyRefunded && !isProcessing && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button type="button" size="sm" className="h-7 px-2 text-xs"
              onClick={() => setPayMode(true)} disabled={cancelPending}>
              <CreditCard className="mr-1 h-3 w-3" /> Pay
            </Button>
            <button type="button" onClick={() => setEditMode(true)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleCancel} disabled={cancelPending}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Cancel">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {canRefund && (
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs"
              onClick={() => setRefundMode(true)} disabled={refundPending}>
              Refund
            </Button>
          </div>
        )}
        {isCancelled && (
          <button type="button" onClick={() => deleteItemAction(item.id, scheduleId)}
            className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive" aria-label="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {payMode && (
        <div className="mt-1.5">
          <MarkPaidForm item={item} onSave={handleMarkPaid} onCancel={() => setPayMode(false)} pending={payPending} />
        </div>
      )}
      {refundMode && (
        <div className="mt-1.5">
          <RefundForm item={item} onSave={handleRefund} onCancel={() => setRefundMode(false)} pending={refundPending} />
        </div>
      )}
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function PaymentScheduleDetail({ schedule, invoice, currentUserRole }: { schedule: PaymentScheduleWithDetails; invoice?: Invoice | null; currentUserRole?: string | null }) {
  const router = useRouter();
  const [items, setItems] = React.useState(schedule.lineItems);
  const [showAdd, setShowAdd] = React.useState(false);
  const [addPending, startAdd] = React.useTransition();

  const totalPaid = computeTotalPaid(items);
  const balance = schedule.totalAmount - totalPaid;
  const pctPaid = schedule.totalAmount > 0 ? Math.min(100, (totalPaid / schedule.totalAmount) * 100) : 0;

  // Booking Financial Architecture Phase 3c — "Never update automatically.
  // Surface a clear Needs Review state." A direct comparison against the
  // linked invoice's current total, not a timestamp or revision counter.
  const reviewStatus = paymentPlanReviewStatus(schedule, invoice?.total ?? null);

  // Allocation tracking (all active installments, whether paid or not)
  const allocated = items.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.amount, 0);
  const remaining = Math.max(0, schedule.totalAmount - allocated);
  const overAllocated = allocated > schedule.totalAmount + 0.005; // 0.5¢ tolerance

  function handleAdd(input: LineItemInput) {
    startAdd(async () => {
      const result = await addLineItemAction(schedule.id, input);
      if (result.ok && "item" in result) {
        setItems((prev) => [...prev, result.item]);
        setShowAdd(false);
        router.refresh();
      } else toast.error(result.message ?? "Could not add payment.");
    });
  }

  function handleItemUpdate(id: string, updated: Partial<PaymentLineItem>) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updated } : i));
    router.refresh();
  }

  function handleMarkPaid(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "paid" as const, paidAt: new Date().toISOString() } : i));
    router.refresh();
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <BusinessAssetHeader
        backHref="/payments"
        backLabel="Payments"
        whatIsThis="Payment Plan"
        title={schedule.title}
        status={<>
          {/* Work Package D8 — this used to say "Needs Review," nearly
              identical wording to ScheduleStatusBadge's own "Needs
              Attention" right next to it for a completely different
              problem (an overdue/refunded installment vs. this schedule
              no longer matching its invoice). Named for what's actually
              wrong instead. */}
          {reviewStatus === "needs_review" && <Badge variant="warning">🟡 Out of Sync with Invoice</Badge>}
          {reviewStatus === "current" && invoice && <Badge variant="success">🟢 Current</Badge>}
          <ScheduleStatusBadge status={schedule.scheduleStatus} />
        </>}
        lastUpdated={new Date(schedule.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        relationship={schedule.clientName ? { name: schedule.clientName, href: `/clients/${schedule.clientId}` } : null}
      />

      {/* Invoice context banner */}
      {invoice && (
        <div className="rounded-sm border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Linked Invoice</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                <span className="font-medium text-heading">{invoice.invoiceNumber}</span>
                <span className="text-muted-foreground">Invoice total: <span className="font-medium text-foreground">{formatCurrency(invoice.total)}</span></span>
                <span className={invoice.balanceDue > 0 ? "text-destructive" : "text-success"}>
                  Balance due: <span className="font-medium">{formatCurrency(invoice.balanceDue)}</span>
                </span>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" render={<Link href={`/invoices/${invoice.id}`} />}>
              View Invoice →
            </Button>
          </div>
        </div>
      )}

      {reviewStatus === "needs_review" && invoice && (
        <ScheduleReviewBanner scheduleId={schedule.id} scheduleTotal={schedule.totalAmount} invoiceTotal={invoice.total} />
      )}

      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your Payment Plan</CardTitle>
          <CardDescription>
            Payment Plan shows the overall schedule. An Invoice asks for a payment now. A Payment is what was actually received.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center sm:text-left sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-xl font-semibold text-heading">{formatMoney(schedule.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid</p>
              <p className="text-xl font-semibold text-success">{formatMoney(totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance</p>
              <p className={`text-xl font-semibold ${balance > 0 ? "text-heading" : "text-success"}`}>
                {balance > 0 ? formatMoney(balance) : "Paid in Full"}
              </p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pctPaid}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{Math.round(pctPaid)}% paid</p>
          {(() => {
            const next = items
              .filter((i) => i.status === "pending" || i.status === "overdue" || i.status === "processing")
              .sort((a, b) => String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999")))[0];
            if (!next) return null;
            return (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next Payment</p>
                <p className="text-lg font-semibold text-heading mt-0.5">
                  {formatMoney(next.amount)}
                  {next.dueDate ? ` · due ${formatDate(next.dueDate)}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">{next.label}</p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Payment Schedule</CardTitle>
              {/* Allocation summary */}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>Allocated: <span className="font-medium text-foreground">{formatMoney(allocated)}</span> of <span className="font-medium text-foreground">{formatMoney(schedule.totalAmount)}</span></span>
                {remaining > 0 && <span className="text-primary font-medium">Remaining: {formatMoney(remaining)}</span>}
                {overAllocated && <span className="text-destructive font-medium">⚠ Over-allocated by {formatMoney(allocated - schedule.totalAmount)}</span>}
                {!overAllocated && remaining <= 0 && allocated > 0 && <span className="text-success font-medium">✓ Fully allocated</span>}
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(true)} disabled={showAdd}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Payment
            </Button>
          </div>
          <CardDescription>Click "Pay" on any item to record a received payment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && !showAdd && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No payments yet. Add a deposit or installment above.
            </p>
          )}
          {items.map((item) => (
            <LineItemRow key={item.id} item={item} scheduleId={schedule.id} scheduleTitle={schedule.title}
              onUpdate={handleItemUpdate} onMarkPaid={handleMarkPaid} onDelete={handleDelete}
              currentUserRole={currentUserRole} />
          ))}
          {showAdd && (
            <div className="space-y-2">
              {remaining > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <span className="text-xs text-muted-foreground flex-1">Remaining balance: <span className="font-semibold text-primary">{formatMoney(remaining)}</span></span>
                  <button type="button"
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    onClick={() => {
                      // Dispatch a custom event that LineItemForm listens for
                      window.dispatchEvent(new CustomEvent("fill-remaining", { detail: remaining.toFixed(2) }));
                    }}>
                    Fill remaining ↗
                  </button>
                </div>
              )}
              <LineItemForm
                initial={{ label: "", amount: "", dueDate: "" }}
                onSave={handleAdd} onCancel={() => setShowAdd(false)}
                pending={addPending} submitLabel="Add" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Package D8 — TR-M1's own "coming soon" card was stale: real
          Stripe Checkout collection shipped for the client portal's own
          "Pay now" button (components/portal/payment-section.tsx) since
          this card was last written, and this component has no venue/
          Stripe-status prop threaded in to conditionally hide it, so the
          copy below is written to be true in both states rather than
          overclaiming a connection that may not exist yet. */}
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-6 flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
            <CreditCard className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-heading">Online payment collection</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your clients can pay pending and overdue installments directly from their portal with a card, once
              you&apos;ve connected a Stripe account. Connect or check your status in{" "}
              <a href="/settings#stripe" className="underline hover:text-foreground">Settings</a>. Payments recorded
              here manually still work exactly as they do today.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Activity */}
      {schedule.activities.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent>
            <ActivityTimeline activities={schedule.activities} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

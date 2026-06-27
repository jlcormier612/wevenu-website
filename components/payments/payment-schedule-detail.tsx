"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
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

import {
  addLineItemAction,
  cancelItemAction,
  deleteItemAction,
  markPaidAction,
  updateLineItemAction,
} from "@/app/(app)/payments/[id]/actions";
import {
  PaymentStatusBadge,
  ScheduleStatusBadge,
} from "@/components/payments/payment-status-badge";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
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
  daysUntil,
  formatDate,
  formatMoney,
  paymentMethodLabel,
} from "@/lib/payments/constants";
import type {
  LineItemInput,
  MarkPaidInput,
  PaymentLineItem,
  PaymentScheduleWithDetails,
} from "@/lib/payments/types";
import { cn } from "@/lib/utils";

// ---- Inline add/edit form ---------------------------------------------------

function LineItemForm({
  initial,
  onSave,
  onCancel,
  pending,
  submitLabel,
}: {
  initial: LineItemInput;
  onSave: (input: LineItemInput) => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
}) {
  const [label, setLabel] = React.useState(initial.label);
  const [amount, setAmount] = React.useState(initial.amount);
  const [dueDate, setDueDate] = React.useState(initial.dueDate);
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end rounded-lg border border-ring bg-card p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Deposit, Final Payment…" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Amount</Label>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5,000" className="w-28" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Due date</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-36" />
      </div>
      <div className="flex items-center gap-1.5 sm:col-span-3 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!label.trim() || !amount.trim() || pending}
          onClick={() => onSave({ label, amount, dueDate })}>
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
          <Select value={method} onValueChange={setMethod}>
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

// ---- Single line item row ---------------------------------------------------

function LineItemRow({
  item,
  scheduleId,
  onUpdate,
  onMarkPaid,
  onDelete,
}: {
  item: PaymentLineItem;
  scheduleId: string;
  onUpdate: (id: string, updated: Partial<PaymentLineItem>) => void;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editMode, setEditMode] = React.useState(false);
  const [payMode, setPayMode] = React.useState(false);
  const [editPending, startEdit] = React.useTransition();
  const [payPending, startPay] = React.useTransition();
  const [cancelPending, startCancel] = React.useTransition();

  const days = item.dueDate ? daysUntil(item.dueDate) : null;
  const isPaid = item.status === "paid";
  const isCancelled = item.status === "cancelled";

  function handleEdit(input: LineItemInput) {
    startEdit(async () => {
      const result = await updateLineItemAction(item.id, scheduleId, input);
      if (result.ok) {
        onUpdate(item.id, { label: input.label.trim(), amount: parseFloat(input.amount), dueDate: input.dueDate || null });
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
        toast.success("Payment recorded.");
      } else toast.error(result.message ?? "Could not record payment.");
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
    return <LineItemForm initial={{ label: item.label, amount: String(item.amount), dueDate: item.dueDate ?? "" }}
      onSave={handleEdit} onCancel={() => setEditMode(false)} pending={editPending} submitLabel="Save" />;
  }

  return (
    <div>
      <div className={cn("group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
        isPaid ? "border-success/20 bg-success/5" : isCancelled ? "border-border opacity-50" : item.status === "overdue" ? "border-destructive/20 bg-destructive/5" : "border-border")}>
        {/* Status icon */}
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
          isPaid ? "border-success bg-success text-white" : item.status === "overdue" ? "border-destructive text-destructive" : "border-border text-muted-foreground")}>
          {isPaid ? <Check className="h-3.5 w-3.5" /> : item.status === "overdue" ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
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
          </div>
        </div>

        {/* Actions */}
        {!isPaid && !isCancelled && (
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
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function PaymentScheduleDetail({ schedule }: { schedule: PaymentScheduleWithDetails }) {
  const router = useRouter();
  const [items, setItems] = React.useState(schedule.lineItems);
  const [showAdd, setShowAdd] = React.useState(false);
  const [addPending, startAdd] = React.useTransition();

  const totalPaid = items.filter((i) => i.status === "paid").reduce((s, i) => s + (i.paidAmount ?? i.amount), 0);
  const balance = schedule.totalAmount - totalPaid;
  const pctPaid = schedule.totalAmount > 0 ? Math.min(100, (totalPaid / schedule.totalAmount) * 100) : 0;

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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground"
            render={<Link href="/payments" />}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Payments
          </Button>
          <h1 className="font-heading text-2xl font-medium text-heading">{schedule.title}</h1>
          {schedule.clientName && (
            <Link href={`/clients/${schedule.clientId}`} className="text-sm text-muted-foreground hover:text-primary">
              {schedule.clientName} →
            </Link>
          )}
        </div>
        <ScheduleStatusBadge status={schedule.scheduleStatus} />
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-5">
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
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pctPaid}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{Math.round(pctPaid)}% paid</p>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Payment Schedule</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(true)}>
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
            <LineItemRow key={item.id} item={item} scheduleId={schedule.id}
              onUpdate={handleItemUpdate} onMarkPaid={handleMarkPaid} onDelete={handleDelete} />
          ))}
          {showAdd && (
            <LineItemForm
              initial={{ label: "", amount: "", dueDate: "" }}
              onSave={handleAdd} onCancel={() => setShowAdd(false)}
              pending={addPending} submitLabel="Add" />
          )}
        </CardContent>
      </Card>

      {/* Stripe Connect placeholder */}
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-6 flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <CreditCard className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-heading">Accept online payments with Stripe</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect your Stripe account to accept deposits and installments directly through Wevenu.
              Live integration coming soon.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled>
            Set up Stripe →
          </Button>
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

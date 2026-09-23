"use client";

/**
 * Pre-portal payment experience for access_level=financial sessions.
 * Same token/client/invoice SoT as the full portal — no temporary records.
 *
 * When the URL includes ?item=<payment_line_item_id>, this page is bound to
 * that specific payment obligation (the installment named in the payment
 * request email). It must NOT silently substitute invoice.balance_due or the
 * next unpaid line after a prior installment was paid.
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pickNextOpenPaymentLine } from "@/lib/invoices/amount-due-now";
import { formatCurrency } from "@/lib/invoices/constants";
import { invoiceHumanLabel } from "@/lib/invoices/display-name";
import type { PortalContext } from "@/lib/portal/types";

type ScheduleLine = {
  id: string;
  label: string | null;
  amount: number;
  status: string;
  obligationKind: string | null;
  paidAmount: number | null;
  dueDate?: string | null;
  sortOrder?: number;
};

type SchedulePayload = {
  schedules: Array<{
    id: string;
    invoiceId: string | null;
    title: string | null;
    totalAmount: number;
    lineItems: ScheduleLine[];
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    displayName?: string | null;
    total: number;
    balanceDue: number;
  }>;
  /** False when venue Stripe Connect is missing/not chargeable — Pay must not look actionable. */
  onlinePaymentsReady?: boolean;
};

function isClosed(status: string): boolean {
  return status === "paid" || status === "waived";
}

export function PaymentAccessShell({
  token,
  context,
}: {
  token: string;
  context: PortalContext;
}) {
  const searchParams = useSearchParams();
  const paymentState = searchParams.get("payment");
  const requestedItemId = searchParams.get("item");
  const [loading, setLoading] = React.useState(true);
  const [paying, setPaying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<SchedulePayload | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function load() {
      try {
        const res = await fetch(`/api/portal/payments?token=${encodeURIComponent(token)}`);
        const payload = (await res.json()) as SchedulePayload;
        if (cancelled) return;
        setData(payload);
        setLoading(false);

        // After Stripe redirect, webhook may land a moment after the page.
        // Refetch briefly so confirmation shows paid + remaining from SoT.
        if (paymentState === "success") {
          const lines = payload.schedules?.[0]?.lineItems ?? [];
          const target = requestedItemId
            ? lines.find((l) => l.id === requestedItemId)
            : pickNextOpenPaymentLine(
                lines.map((l) => ({
                  ...l,
                  dueDate: l.dueDate ?? null,
                  label: l.label ?? undefined,
                })),
              );
          const stillOpen = target ? !isClosed(target.status) : lines.some((l) => !isClosed(l.status));
          if (stillOpen && attempts < 6) {
            attempts += 1;
            window.setTimeout(() => {
              if (!cancelled) void load();
            }, 1500);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Could not load your payment details.");
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, paymentState, requestedItemId]);

  const schedule = data?.schedules?.[0] ?? null;
  const lines = schedule?.lineItems ?? [];

  const boundLine = requestedItemId
    ? lines.find((l) => l.id === requestedItemId) ?? null
    : null;
  const boundMissing = Boolean(requestedItemId) && data != null && !boundLine;

  // Bound request → that obligation only. Unbound legacy links → next open by due/sort.
  const payableLine: ScheduleLine | null = boundLine
    ? isClosed(boundLine.status)
      ? null
      : boundLine
    : pickNextOpenPaymentLine(
        lines.map((l) => ({
          ...l,
          dueDate: l.dueDate ?? null,
          label: l.label ?? undefined,
        })),
      );

  const boundAlreadyPaid = Boolean(boundLine && isClosed(boundLine.status));
  const paidTotal = lines.reduce(
    (sum, l) => sum + (Number(l.paidAmount) || (l.status === "paid" ? l.amount : 0)),
    0,
  );
  const remaining = Math.max(0, (schedule?.totalAmount ?? 0) - paidTotal);
  // Stripe success redirect can race the webhook. Only optimistic-adjust while
  // SoT still shows nothing paid for the requested/next line.
  const webhookPending =
    paymentState === "success" &&
    Boolean(payableLine) &&
    (boundLine
      ? Number(boundLine.paidAmount || 0) === 0 && !isClosed(boundLine.status)
      : paidTotal === 0);
  const displayRemaining = webhookPending
    ? Math.max(0, remaining - (payableLine?.amount ?? 0))
    : remaining;
  const invoice = data?.invoices?.find((i) => i.id === schedule?.invoiceId) ?? data?.invoices?.[0];
  const headlineLabel = boundLine?.label || payableLine?.label;
  const invoiceLabel = invoiceHumanLabel({
    displayName: invoice?.displayName ?? schedule?.title ?? headlineLabel,
    invoiceNumber: invoice?.invoiceNumber ?? "Invoice",
  });
  const onlinePaymentsReady = data?.onlinePaymentsReady === true;
  const canPayOnline = Boolean(payableLine) && onlinePaymentsReady && !boundMissing;

  async function payNow() {
    if (!payableLine || !onlinePaymentsReady) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, itemId: payableLine.id }),
      });
      const json = (await res.json()) as { checkoutUrl?: string; error?: string; message?: string };
      if (!res.ok || !json.checkoutUrl) {
        setError(json.error ?? json.message ?? "Could not start checkout.");
        setPaying(false);
        return;
      }
      window.location.href = json.checkoutUrl;
    } catch {
      setError("Could not start checkout.");
      setPaying(false);
    }
  }

  const brand = context.venue.primaryColor || "#5D6F5D";
  const confirmed =
    boundAlreadyPaid ||
    paymentState === "success" ||
    (payableLine == null && paidTotal > 0 && !requestedItemId);

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-foreground">
      <header className="border-b border-border/60 bg-white/80 px-4 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {context.venue.name}
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-heading">{invoiceLabel}</h1>
      </header>

      <main className="mx-auto max-w-md px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : boundMissing ? (
          <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-heading">This payment link is not valid</p>
            <p className="text-sm text-muted-foreground">
              The requested payment could not be found. Please contact {context.venue.name} for a new
              payment link.
            </p>
          </div>
        ) : confirmed ? (
          <div className="space-y-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Payment received</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {boundAlreadyPaid
                  ? `Thank you — ${formatCurrency(boundLine!.amount)} for ${boundLine!.label || "this payment"} has already been received.`
                  : "Thank you — your payment has been received."}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-heading">{invoiceLabel}</p>
              {lines.map((l) => {
                const showPaid =
                  isClosed(l.status) ||
                  (webhookPending && payableLine?.id === l.id);
                return (
                  <div key={l.id} className="flex justify-between gap-3 text-muted-foreground">
                    <span>
                      {l.label || "Payment"}
                      {showPaid ? " — Paid" : ""}
                    </span>
                    <span>{formatCurrency(l.amount)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-medium text-heading">
                <span>Remaining balance</span>
                <span>{formatCurrency(displayRemaining)}</span>
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-heading">What&apos;s next?</p>
              <p className="mt-1">
                Your venue is completing your booking setup. You&apos;ll receive an invitation when your
                client workspace is ready.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div>
              <p className="text-3xl font-semibold text-heading">
                {formatCurrency(payableLine?.amount ?? remaining)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {payableLine?.label || "Amount due"} · due now
              </p>
              {schedule && schedule.totalAmount > (payableLine?.amount ?? 0) ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Total contracted {formatCurrency(schedule.totalAmount)}
                  {paidTotal > 0 ? ` · Paid to date ${formatCurrency(paidTotal)}` : null}
                  {" · "}
                  Remaining after this payment{" "}
                  {formatCurrency(Math.max(0, remaining - (payableLine?.amount ?? 0)))}
                </p>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              This payment is part of your agreement with {context.venue.name}.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!onlinePaymentsReady ? (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-heading">Online payments unavailable</p>
                <p className="text-sm text-muted-foreground">
                  Your venue hasn&apos;t connected online payments yet. Please contact{" "}
                  {context.venue.name} to arrange payment.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                className="w-full"
                style={{ backgroundColor: brand }}
                disabled={paying || !canPayOnline}
                onClick={() => void payNow()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting checkout…
                  </>
                ) : (
                  `Pay ${formatCurrency(payableLine?.amount ?? 0)}`
                )}
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Reference: {invoice?.invoiceNumber ?? "—"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

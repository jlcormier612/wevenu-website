"use client";

/**
 * Pre-portal Invoice & Payment Plan experience for access_level=financial.
 * Same token/client/invoice SoT as the full portal — no temporary records.
 * Not the normal couple planning workspace.
 *
 * When the URL includes ?item=<payment_line_item_id>, Pay is bound to that
 * installment. It must NOT silently substitute invoice.balance_due or the
 * next unpaid line after a prior installment was paid.
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pickNextOpenPaymentLine, resolveAmountDueNow } from "@/lib/invoices/amount-due-now";
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
    dueDate?: string | null;
    status?: string;
  }>;
  /** False when venue Stripe Connect is missing/not chargeable — Pay must not look actionable. */
  onlinePaymentsReady?: boolean;
  /** Venue-local calendar date for amount-due-now gating. */
  businessToday?: string | null;
};

function isClosed(status: string): boolean {
  return status === "paid" || status === "waived";
}

function formatDue(dueDate: string | null | undefined): string {
  if (!dueDate) return "Date TBD";
  return new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function clientDisplayName(context: PortalContext): string {
  const a = [context.client.firstName, context.client.lastName].filter(Boolean).join(" ").trim();
  const b = [context.client.partnerFirstName, context.client.partnerLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (a && b) return `${a} & ${b}`;
  return a || b || "Client";
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

  const invoice = data?.invoices?.find((i) => i.id === schedule?.invoiceId) ?? data?.invoices?.[0];
  const paidTotal = lines.reduce(
    (sum, l) => sum + (Number(l.paidAmount) || (l.status === "paid" ? l.amount : 0)),
    0,
  );
  const remaining = Math.max(0, (schedule?.totalAmount ?? 0) - paidTotal);
  const balanceDue = invoice?.balanceDue ?? remaining;

  const mappedLines = lines.map((l) => ({
    amount: l.amount,
    dueDate: l.dueDate ?? null,
    status: l.status,
    label: l.label ?? undefined,
    obligationKind: l.obligationKind,
    sortOrder: l.sortOrder,
    id: l.id,
  }));

  // Bound email link → that obligation only (if still open).
  // Unbound → amount-due-now (venue business day), never a future installment.
  let payableLine: ScheduleLine | null = null;
  if (boundLine && !isClosed(boundLine.status)) {
    payableLine = boundLine;
  } else if (!requestedItemId && data?.businessToday) {
    const due = resolveAmountDueNow({
      balanceDue,
      scheduleLines: mappedLines,
      today: data.businessToday,
    });
    if (due.kind === "next_installment") {
      const open = pickNextOpenPaymentLine(mappedLines);
      payableLine = open ? lines.find((l) => l.id === open.id) ?? null : null;
    }
  }

  const boundAlreadyPaid = Boolean(boundLine && isClosed(boundLine.status));
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
  const invoiceLabel = invoiceHumanLabel({
    displayName: invoice?.displayName ?? schedule?.title,
    invoiceNumber: invoice?.invoiceNumber ?? "Invoice",
  });
  const onlinePaymentsReady = data?.onlinePaymentsReady === true;
  const canPayOnline = Boolean(payableLine) && onlinePaymentsReady && !boundMissing;
  const brand = context.venue.primaryColor || "#5D6F5D";
  const coupleName = clientDisplayName(context);
  const eventDateLabel = context.event?.eventDate
    ? formatDue(context.event.eventDate)
    : null;
  const contractedTotal = invoice?.total ?? schedule?.totalAmount ?? 0;

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

  const confirmed =
    boundAlreadyPaid ||
    paymentState === "success" ||
    (payableLine == null && paidTotal > 0 && !requestedItemId);

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-foreground">
      <header
        className="px-4 py-8 text-white"
        style={{ backgroundColor: brand }}
        data-testid="invoice-payment-plan-header"
      >
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {context.venue.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={context.venue.logoUrl}
                alt={context.venue.name}
                className="h-12 w-12 rounded-lg object-contain"
                style={{ background: "rgba(255,255,255,0.15)" }}
              />
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
                Invoice &amp; Payment Plan
              </p>
              <h1 className="mt-1 font-heading text-2xl font-semibold">{context.venue.name}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tracking-wide">
              {invoice?.invoiceNumber ?? "—"}
            </p>
            <p className="text-sm opacity-80">{invoiceLabel}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
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
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <p className="text-sm text-muted-foreground">Prepared for</p>
              <p className="text-lg font-semibold text-heading">{coupleName}</p>
              {eventDateLabel ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {context.event?.name ? `${context.event.name} · ` : ""}
                  {eventDateLabel}
                </p>
              ) : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total contracted
                  </p>
                  <p className="mt-1 text-base font-semibold text-heading">
                    {formatCurrency(contractedTotal)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Paid to date
                  </p>
                  <p className="mt-1 text-base font-semibold text-heading">
                    {formatCurrency(
                      webhookPending
                        ? paidTotal + (payableLine?.amount ?? 0)
                        : Math.max(0, contractedTotal - balanceDue),
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Balance remaining
                  </p>
                  <p className="mt-1 text-base font-semibold text-heading">
                    {formatCurrency(displayRemaining)}
                  </p>
                </div>
              </div>
            </div>

            {confirmed ? (
              <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-emerald-700">Payment received</p>
                <p className="text-sm text-muted-foreground">
                  {boundAlreadyPaid
                    ? `Thank you — ${formatCurrency(boundLine!.amount)} for ${boundLine!.label || "this payment"} has already been received.`
                    : "Thank you — your payment has been received."}
                </p>
                <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-heading">What&apos;s next?</p>
                  <p className="mt-1">
                    Your venue is completing your booking setup. You&apos;ll receive an invitation when your
                    client workspace is ready.
                  </p>
                </div>
              </div>
            ) : payableLine ? (
              <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Amount due now
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-heading">
                    {formatCurrency(payableLine.amount)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {payableLine.label || "Payment"}
                    {payableLine.dueDate ? ` · due ${formatDue(payableLine.dueDate)}` : " · due now"}
                  </p>
                </div>
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
                    data-testid="invoice-pay-now"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting checkout…
                      </>
                    ) : (
                      `Pay ${formatCurrency(payableLine.amount)} Now`
                    )}
                  </Button>
                )}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-heading">Payment plan</p>
              {lines.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No installment schedule is on file.</p>
              ) : (
                <div className="mt-4 divide-y divide-border">
                  {lines.map((l) => {
                    const showPaid =
                      isClosed(l.status) ||
                      (webhookPending && payableLine?.id === l.id);
                    return (
                      <div
                        key={l.id}
                        className="flex items-start justify-between gap-3 py-3 text-sm"
                        data-testid="invoice-schedule-line"
                      >
                        <div>
                          <p className="font-medium text-heading">
                            {l.label || "Payment"}
                            {showPaid ? " — Paid" : ""}
                          </p>
                          <p className="text-muted-foreground">Due {formatDue(l.dueDate)}</p>
                        </div>
                        <p className="font-medium text-heading">{formatCurrency(l.amount)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Reference: {invoice?.invoiceNumber ?? "—"}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

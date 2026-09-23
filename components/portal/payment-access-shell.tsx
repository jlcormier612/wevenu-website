"use client";

/**
 * Pre-portal payment experience for access_level=financial sessions.
 * Same token/client/invoice SoT as the full portal — no temporary records.
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function PaymentAccessShell({
  token,
  context,
}: {
  token: string;
  context: PortalContext;
}) {
  const searchParams = useSearchParams();
  const paymentState = searchParams.get("payment");
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
          const stillOpen = lines.some((l) => l.status !== "paid" && l.status !== "waived");
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
  }, [token, paymentState]);

  const schedule = data?.schedules?.[0] ?? null;
  const lines = schedule?.lineItems ?? [];
  const nextOpen = lines.find((l) => l.status !== "paid" && l.status !== "waived") ?? null;
  const paidTotal = lines.reduce((sum, l) => sum + (Number(l.paidAmount) || (l.status === "paid" ? l.amount : 0)), 0);
  const remaining = Math.max(0, (schedule?.totalAmount ?? 0) - paidTotal);
  // Stripe success redirect can race the webhook; treat the open installment as paid for display.
  const displayRemaining =
    paymentState === "success" && nextOpen
      ? Math.max(0, remaining - nextOpen.amount)
      : remaining;
  const invoice = data?.invoices?.find((i) => i.id === schedule?.invoiceId) ?? data?.invoices?.[0];
  const invoiceLabel = invoiceHumanLabel({
    displayName: invoice?.displayName ?? schedule?.title ?? nextOpen?.label,
    invoiceNumber: invoice?.invoiceNumber ?? "Invoice",
  });
  const onlinePaymentsReady = data?.onlinePaymentsReady === true;
  const canPayOnline = Boolean(nextOpen) && onlinePaymentsReady;

  async function payNow() {
    if (!nextOpen || !onlinePaymentsReady) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, itemId: nextOpen.id }),
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
  const confirmed = paymentState === "success" || (nextOpen == null && paidTotal > 0);

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
        ) : confirmed ? (
          <div className="space-y-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Payment received</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Thank you — your payment has been received.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-heading">{invoiceLabel}</p>
              {lines.map((l) => (
                <div key={l.id} className="flex justify-between gap-3 text-muted-foreground">
                  <span>
                    {l.label || "Payment"}
                    {l.status === "paid" || paymentState === "success" ? " — Paid" : ""}
                  </span>
                  <span>{formatCurrency(l.amount)}</span>
                </div>
              ))}
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
                {formatCurrency(nextOpen?.amount ?? remaining)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {nextOpen?.label || "Amount due"} · due now
              </p>
              {schedule && schedule.totalAmount > (nextOpen?.amount ?? 0) ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Total contracted {formatCurrency(schedule.totalAmount)}
                  {paidTotal > 0 ? ` · Paid to date ${formatCurrency(paidTotal)}` : null}
                  {" · "}
                  Remaining after this payment{" "}
                  {formatCurrency(Math.max(0, remaining - (nextOpen?.amount ?? 0)))}
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
                  `Pay ${formatCurrency(nextOpen?.amount ?? 0)}`
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

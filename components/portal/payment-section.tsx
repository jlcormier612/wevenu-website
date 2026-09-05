"use client";

import * as React from "react";
import { getPaymentObservations } from "@/lib/luv/portal-observations";
import {
  CHECKOUT_BASELINE_STORAGE_KEY,
  parseCheckoutReturnQuery,
  readCheckoutBaseline,
  resolveCheckoutNotice,
  serializeCheckoutBaseline,
  settledPaidTotal,
  type CheckoutBaseline,
  type CheckoutNoticeKind,
} from "@/lib/portal/checkout-return-notice";

// ── Types ─────────────────────────────────────────────────────────────────────

// Work Package D8 — this was a hand-maintained copy of lib/payments/types.ts's
// real PaymentItemStatus, missing "partially_refunded" and "refunded" (both
// added there since). A refunded item fell through StatusPill's every
// explicit branch to the generic default below, which reads like a normal
// upcoming payment — a real, customer-facing correctness gap for a couple
// checking their own portal. Kept as this component's own local type
// (it receives plain data, not a live import) but now matching the real set.
type PaymentStatus = "pending" | "processing" | "overdue" | "paid" | "cancelled" | "partially_refunded" | "refunded";

type PortalPaymentItem = {
  id: string;
  label: string;
  amount: number;
  dueDate: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  notes: string | null;
  sortOrder: number;
};

const CHECKOUT_POLL_MS = 2500;
const CHECKOUT_POLL_MAX_MS = 90_000;

type PortalPaymentSchedule = {
  id: string;
  title: string;
  totalAmount: number;
  currency: string;
  notes: string | null;
  invoiceId: string | null;
  createdAt: string;
  lineItems: PortalPaymentItem[];
};

// ── Palette ───────────────────────────────────────────────────────────────────
// Venue Brand Experience Phase 1: SAGE is the venue's own primary color now.
// ROSE stays Luv's persona identity, unchanged (her observation panel below).

const ROSE  = "#D8A7AA";
const SAGE  = "var(--venue-primary)";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function daysUntilDate(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function computeTotals(schedule: PortalPaymentSchedule) {
  const paid = schedule.lineItems
    .filter(i => i.status === "paid" || i.status === "partially_refunded")
    .reduce((s, i) => s + (i.paidAmount ?? i.amount) - 0, 0);
  // Refunded rows contribute 0 remaining owed from that line; portal RPC may
  // not expose refundedAmount — prefer paidAmount when present.
  return { paid, remaining: Math.max(0, schedule.totalAmount - paid) };
}

function nextUnpaidItem(items: PortalPaymentItem[]): PortalPaymentItem | null {
  const open = items
    .filter((i) => i.status === "pending" || i.status === "overdue" || i.status === "processing")
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return a.sortOrder - b.sortOrder;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate) || a.sortOrder - b.sortOrder;
    });
  return open[0] ?? null;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusPill({ status, dueDate }: { status: PaymentStatus; dueDate: string | null }) {
  const days = dueDate ? daysUntilDate(dueDate) : null;

  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "#EDF7ED", color: "#2E6B2E" }}>
        ✓ Paid
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "#FEF2F2", color: "#991B1B" }}>
        Overdue
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "#EFF6FF", color: "#1D4ED8" }}>
        Processing
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "#F3F4F6", color: "#4B5563" }}>
        Refunded
      </span>
    );
  }
  if (status === "partially_refunded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "#F3F4F6", color: "#4B5563" }}>
        Partially refunded
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "#F3F4F6", color: "#6B7280" }}>
        Cancelled
      </span>
    );
  }
  if (days !== null && days === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "#FEF3C7", color: "#92400E" }}>
        Due today
      </span>
    );
  }
  if (days !== null && days > 0 && days <= 14) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "#FEF3C7", color: "#92400E" }}>
        Due in {days}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: "#F3F4F6", color: "#374151" }}>
      Upcoming
    </span>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({
  schedule, token, paidTotal,
}: {
  schedule: PortalPaymentSchedule;
  token: string;
  paidTotal: number;
}) {
  const { remaining } = computeTotals(schedule);
  const paidPct = schedule.totalAmount > 0 ? Math.round((paidTotal / schedule.totalAmount) * 100) : 0;
  const allPaid = remaining <= 0;
  const next = nextUnpaidItem(schedule.lineItems);

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: `linear-gradient(135deg, #F7F4F0 0%, #F2EDE6 100%)`, border: "1px solid #E8E2D8" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: ROSE }}>
              Your Payment Plan
            </p>
            <p className="font-heading text-3xl font-medium text-heading">
              {formatMoney(schedule.totalAmount, schedule.currency)}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">Total</p>
          </div>
          {allPaid && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{ background: "#EDF7ED" }}>
              ✓
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: "#E8E2D8" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${paidPct}%`, background: allPaid ? SAGE : ROSE }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{paidPct}% paid</span>
            {!allPaid && <span>{formatMoney(remaining, schedule.currency)} remaining</span>}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.7)" }}>
            <p className="text-xs text-muted-foreground mb-0.5">Paid</p>
            <p className="text-base font-semibold" style={{ color: SAGE }}>{formatMoney(paidTotal, schedule.currency)}</p>
          </div>
          {!allPaid && (
            <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.7)" }}>
              <p className="text-xs text-muted-foreground mb-0.5">Remaining</p>
              <p className="text-base font-semibold text-heading">{formatMoney(remaining, schedule.currency)}</p>
            </div>
          )}
        </div>
      </div>

      {next && (
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "#FAFAF9", border: `1px solid ${ROSE}40` }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ROSE }}>
            Next Payment
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-heading text-2xl font-medium text-heading">
                {formatMoney(next.amount, schedule.currency)}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {next.label}
                {next.dueDate ? ` · Due ${formatDate(next.dueDate)}` : ""}
              </p>
            </div>
            {(next.status === "pending" || next.status === "overdue") && (
              <PayNowButton token={token} itemId={next.id} paidTotal={paidTotal} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pay Now ───────────────────────────────────────────────────────────────────

function PayNowButton({
  token, itemId, paidTotal,
}: {
  token: string;
  itemId: string;
  paidTotal: number;
}) {
  const [loading, setLoading] = React.useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      // Baseline for the return notice: Checkout redirect alone is not confirmation.
      try {
        const baseline: CheckoutBaseline = {
          itemId,
          paidTotal,
          at: Date.now(),
        };
        sessionStorage.setItem(CHECKOUT_BASELINE_STORAGE_KEY, serializeCheckoutBaseline(baseline));
      } catch {
        // sessionStorage may be unavailable; return notice still stays confirming.
      }
      const res = await fetch("/api/portal/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, itemId }),
      });
      const data = await res.json() as { checkoutUrl?: string; error?: string };
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      alert(data.error ?? "Could not start checkout.");
    } catch {
      alert("Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: SAGE }}
    >
      {loading ? "Loading…" : "Pay now"}
    </button>
  );
}

// ── Payment timeline ──────────────────────────────────────────────────────────

function PaymentTimeline({
  items, token, paidTotal,
}: {
  items: PortalPaymentItem[];
  token: string;
  paidTotal: number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
        Payment Schedule
      </p>
      <div className="space-y-2">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <div key={item.id} className="relative">
              {/* Connecting line */}
              {!isLast && (
                <div
                  className="absolute left-4 top-8 w-0.5 h-4"
                  style={{ background: item.status === "paid" ? "#B9D1C2" : "#E5E7EB" }}
                />
              )}

              <div
                className="flex items-start gap-4 rounded-xl p-4"
                style={{
                  background: item.status === "overdue"
                    ? "#FEF2F2"
                    : item.status === "paid"
                    ? "#F7FBF8"
                    : item.status === "processing"
                    ? "#EFF6FF"
                    : "#FAFAF9",
                  border: `1px solid ${
                    item.status === "overdue" ? "#FECACA"
                    : item.status === "paid" ? "#B9D1C2"
                    : item.status === "processing" ? "#BFDBFE"
                    : "#E8E2D8"
                  }`,
                }}
              >
                {/* Circle indicator */}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold mt-0.5"
                  style={{
                    background: item.status === "paid" ? SAGE
                      : item.status === "overdue" ? "#FCA5A5"
                      : item.status === "processing" ? "#93C5FD"
                      : "#E8E2D8",
                    color: item.status === "paid" ? "white"
                      : item.status === "overdue" ? "#7F1D1D"
                      : item.status === "processing" ? "#1E3A8A"
                      : "#6B7280",
                  }}
                >
                  {item.status === "paid" ? "✓" : `${idx + 1}`}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-heading">{item.label}</p>
                      {item.dueDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.status === "paid"
                            ? `Paid ${item.paidAt ? formatDate(item.paidAt) : "—"}`
                            : `Due ${formatDate(item.dueDate)}`}
                        </p>
                      )}
                      {item.status === "paid" && item.paymentMethod && (
                        <p className="text-xs text-muted-foreground">via {item.paymentMethod.replace(/_/g, " ")}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <p className="text-sm font-semibold text-heading">
                        {formatMoney(item.paidAmount ?? item.amount)}
                      </p>
                      <StatusPill status={item.status} dueDate={item.dueDate} />
                      {(item.status === "pending" || item.status === "overdue") && (
                        <div><PayNowButton token={token} itemId={item.id} paidTotal={paidTotal} /></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

async function fetchPortalSchedules(token: string): Promise<PortalPaymentSchedule[]> {
  const res = await fetch(`/api/portal/payments?token=${encodeURIComponent(token)}`);
  const data = await res.json() as { schedules?: PortalPaymentSchedule[]; error?: string };
  return data.schedules ?? [];
}

export function PaymentSection({ token }: { token: string }) {
  const [schedules, setSchedules] = React.useState<PortalPaymentSchedule[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [checkoutReturn, setCheckoutReturn] = React.useState<"success" | "cancelled" | null>(null);
  const [checkoutBaseline, setCheckoutBaseline] = React.useState<CheckoutBaseline | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = parseCheckoutReturnQuery(params.get("payment"));
    if (payment) {
      setCheckoutReturn(payment);
      params.delete("payment");
      const next = params.toString();
      const hash = window.location.hash || (payment === "success" || payment === "cancelled" ? "#payments" : "");
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (next ? `?${next}` : "") + hash,
      );
    }
    try {
      setCheckoutBaseline(readCheckoutBaseline(sessionStorage.getItem(CHECKOUT_BASELINE_STORAGE_KEY)));
    } catch {
      setCheckoutBaseline(null);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPortalSchedules(token)
      .then((next) => { if (!cancelled) setSchedules(next); })
      .catch(() => { if (!cancelled) setSchedules([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const schedule = schedules?.[0] ?? null;
  const allItems = schedule?.lineItems ?? [];
  const paidTotal = settledPaidTotal(allItems);
  const checkoutNotice: CheckoutNoticeKind = resolveCheckoutNotice({
    checkoutReturn,
    lineItems: loading ? null : allItems,
    baseline: checkoutBaseline,
  });

  // Poll while Checkout returned successfully but HTC has not confirmed yet.
  React.useEffect(() => {
    if (checkoutNotice !== "confirming") return;
    const started = Date.now();
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - started > CHECKOUT_POLL_MAX_MS) return;
      try {
        const next = await fetchPortalSchedules(token);
        if (!cancelled) setSchedules(next);
      } catch {
        // Keep the confirming notice; next interval retries.
      }
    };
    const id = window.setInterval(() => { void tick(); }, CHECKOUT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [checkoutNotice, token]);

  React.useEffect(() => {
    if (checkoutNotice !== "confirmed") return;
    try {
      sessionStorage.removeItem(CHECKOUT_BASELINE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [checkoutNotice]);

  if (loading) {
    return (
      <div className="space-y-6 px-1">
        <div>
          <div className="h-7 w-32 rounded-lg bg-muted/60 animate-pulse" />
          <div className="h-4 w-56 rounded bg-muted/40 animate-pulse mt-2" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
                <div className="h-6 w-20 rounded bg-muted/60 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
                <div className="h-4 w-4 rounded-full bg-muted/60 animate-pulse" />
                <div className="flex-1 h-4 rounded bg-muted/40 animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted/40 animate-pulse" />
                <div className="h-4 w-14 rounded bg-muted/60 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!schedules || schedules.length === 0 || !schedule) {
    return (
      <div className="space-y-6 px-1">
        {checkoutNotice === "confirming" && (
          <div className="rounded-xl px-4 py-3 text-sm space-y-1" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A" }}>
            <p className="font-medium">Confirming your payment</p>
            <p>Checkout finished. We&apos;re waiting for your venue ledger to confirm the payment.</p>
          </div>
        )}
        {checkoutNotice === "cancelled" && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "#FAFAF9", border: "1px solid #E8E2D8", color: "#57534E" }}>
            Checkout was cancelled — nothing was charged.
          </div>
        )}
        <div>
          <h2 className="font-heading text-2xl font-medium text-heading">Payments</h2>
          <p className="text-sm text-muted-foreground mt-1">Your payment schedule with your venue.</p>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <p className="text-3xl mb-3">💳</p>
          <p className="text-sm font-medium text-heading mb-1">No payment schedule yet</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Your venue coordinator will set up your payment plan here. Check back soon or reach out if you have questions.
          </p>
        </div>
      </div>
    );
  }

  // API returns one schedule per invoice (newest). Emma-style single-invoice
  // relationships see exactly that plan; multi-invoice clients still pick the
  // newest plan here (pre-existing Payments destination limitation).
  const luvObs = getPaymentObservations(allItems);
  const { remaining } = computeTotals(schedule);
  const next = nextUnpaidItem(allItems);

  return (
    <div className="space-y-6 px-1">
      {checkoutNotice === "confirming" && (
        <div className="rounded-xl px-4 py-3 text-sm space-y-1" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A" }}>
          <p className="font-medium">Confirming your payment</p>
          <p>Checkout finished. Your balance updates when Hello to Cheers confirms the payment — this can take a moment.</p>
          <p>Current remaining balance: {formatMoney(remaining, schedule.currency)}</p>
        </div>
      )}
      {checkoutNotice === "confirmed" && (
        <div className="rounded-xl px-4 py-3 text-sm space-y-1" style={{ background: "#F7FBF8", border: "1px solid #B9D1C2", color: "#1F5C3D" }}>
          <p className="font-medium">Payment confirmed</p>
          <p>Thank you — your payment is reflected on your plan.</p>
          <p>Remaining balance: {formatMoney(remaining, schedule.currency)}</p>
          {next?.dueDate && (
            <p>Next payment due: {formatDate(next.dueDate)}{next.amount != null ? ` · ${formatMoney(next.amount, schedule.currency)}` : ""}</p>
          )}
        </div>
      )}
      {checkoutNotice === "cancelled" && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "#FAFAF9", border: "1px solid #E8E2D8", color: "#57534E" }}>
          Checkout was cancelled — nothing was charged.
        </div>
      )}
      {/* Header */}
      <div>
        <h2 className="font-heading text-2xl font-medium text-heading">Your Payments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          What you&apos;ve paid, what&apos;s next, and how to pay.
        </p>
      </div>

      {/* Summary */}
      <SummaryBar schedule={schedule} token={token} paidTotal={paidTotal} />

      {/* Luv observations */}
      {luvObs.length > 0 && (
        <div className="space-y-2">
          {luvObs.map(obs => (
            <div
              key={obs.id}
              className="rounded-xl px-4 py-3 flex items-start gap-2.5"
              style={{
                background: obs.kind === "flag" ? "#FDF5F5" : obs.kind === "nudge" ? "#FFFBF0" : "#F7FBF8",
                border: `1px solid ${obs.kind === "flag" ? "#D8A7AA40" : obs.kind === "nudge" ? "#D4A01740" : "#B9D1C230"}`,
              }}
            >
              <span style={{ color: ROSE, fontSize: 14, lineHeight: 1.5 }}>💗</span>
              <p className="text-sm leading-relaxed" style={{ color: "#5A3235" }}>{obs.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {allItems.length > 0 && <PaymentTimeline items={allItems} token={token} paidTotal={paidTotal} />}

      {/* Notes */}
      {schedule.notes && (
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "#F7F4F0", border: "1px solid #E8E2D8" }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Notes from your venue</p>
          <p className="text-sm text-foreground leading-relaxed">{schedule.notes}</p>
        </div>
      )}

      {/* Contact footer */}
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: "#FDF5F5", border: `1px solid ${ROSE}20` }}
      >
        <span style={{ color: ROSE }}>💗</span>
        <div>
          <p className="text-xs font-semibold" style={{ color: "#5A3235" }}>Questions about payments?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contact your venue coordinator through the Messages tab or reach out directly.
          </p>
        </div>
      </div>
    </div>
  );
}

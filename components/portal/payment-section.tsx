"use client";

import * as React from "react";
import { getPaymentObservations } from "@/lib/luv/portal-observations";

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentStatus = "pending" | "overdue" | "paid" | "cancelled";

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

const ROSE  = "#D8A7AA";
const SAGE  = "#5D6F5D";

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
    .filter(i => i.status === "paid")
    .reduce((s, i) => s + (i.paidAmount ?? i.amount), 0);
  return { paid, remaining: schedule.totalAmount - paid };
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

function SummaryBar({ schedule }: { schedule: PortalPaymentSchedule }) {
  const { paid, remaining } = computeTotals(schedule);
  const paidPct = schedule.totalAmount > 0 ? Math.round((paid / schedule.totalAmount) * 100) : 0;
  const allPaid = remaining <= 0;

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: `linear-gradient(135deg, #F7F4F0 0%, #F2EDE6 100%)`, border: "1px solid #E8E2D8" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: ROSE }}>
            {schedule.title}
          </p>
          <p className="font-heading text-3xl font-medium text-heading">
            {formatMoney(schedule.totalAmount, schedule.currency)}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">Total contract value</p>
        </div>
        {allPaid && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
            style={{ background: "#EDF7ED" }}>
            ✓
          </div>
        )}
      </div>

      {/* Progress bar */}
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

      {/* Paid / Remaining pills */}
      <div className="flex gap-4">
        <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.7)" }}>
          <p className="text-xs text-muted-foreground mb-0.5">Paid</p>
          <p className="text-base font-semibold" style={{ color: SAGE }}>{formatMoney(paid, schedule.currency)}</p>
        </div>
        {!allPaid && (
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.7)" }}>
            <p className="text-xs text-muted-foreground mb-0.5">Remaining</p>
            <p className="text-base font-semibold text-heading">{formatMoney(remaining, schedule.currency)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Payment timeline ──────────────────────────────────────────────────────────

function PaymentTimeline({ items }: { items: PortalPaymentItem[] }) {
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
                    : "#FAFAF9",
                  border: `1px solid ${
                    item.status === "overdue" ? "#FECACA"
                    : item.status === "paid" ? "#B9D1C2"
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
                      : "#E8E2D8",
                    color: item.status === "paid" ? "white"
                      : item.status === "overdue" ? "#7F1D1D"
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

export function PaymentSection({ token }: { token: string }) {
  const [schedules, setSchedules] = React.useState<PortalPaymentSchedule[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/portal/payments?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((d: { schedules?: PortalPaymentSchedule[]; error?: string }) => {
        setSchedules(d.schedules ?? []);
      })
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [token]);

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

  if (!schedules || schedules.length === 0) {
    return (
      <div className="space-y-6 px-1">
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

  // Show the most recent schedule (venues typically have one per client)
  const schedule = schedules[0];
  const allItems = schedule.lineItems;
  const luvObs = getPaymentObservations(allItems);

  return (
    <div className="space-y-6 px-1">
      {/* Header */}
      <div>
        <h2 className="font-heading text-2xl font-medium text-heading">Payments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your financial picture with your venue — all in one place.
        </p>
      </div>

      {/* Summary */}
      <SummaryBar schedule={schedule} />

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
      {allItems.length > 0 && <PaymentTimeline items={allItems} />}

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

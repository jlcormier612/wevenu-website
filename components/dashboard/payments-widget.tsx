import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import { AttentionList } from "@/components/dashboard-system/attention-list";
import { daysUntil, formatDate, formatMoney } from "@/lib/payments/constants";
import type { DashboardPayment } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

function PaymentRow({ p }: { p: DashboardPayment }) {
  const days = daysUntil(p.dueDate);
  const past = days < 0;
  return (
    <Link
      href={`/payments/${p.scheduleId}`}
      className="flex items-start justify-between gap-3 -mx-2 rounded-lg px-2 py-2.5 hover:bg-muted/40 transition-colors"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground">{p.label}</p>
        {p.clientName && (
          <p className="text-xs text-muted-foreground truncate">{p.clientName}</p>
        )}
      </div>
      <div className="shrink-0 text-right space-y-0.5">
        <p className="text-sm font-semibold text-foreground">{formatMoney(p.amount)}</p>
        <p className={cn("text-xs", past || p.isOverdue ? "font-medium text-destructive" : days <= 7 ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
          {past || p.isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d`}
          {" · "}{formatDate(p.dueDate)}
        </p>
      </div>
    </Link>
  );
}

// Dashboard Component System, Phase 1 Step 2 — shell migrated to
// AttentionList; row content and copy unchanged.
export function OverduePaymentsWidget({ payments }: { payments: DashboardPayment[] }) {
  return (
    <AttentionList
      icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
      title="Overdue Payments"
      description="Payments past their due date."
      headerRight={
        payments.length > 0 && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">{payments.length}</span>
        )
      }
      items={payments}
      getKey={(p) => p.id}
      emptyState={
        <p className="py-3 text-center text-sm text-muted-foreground">No overdue payments. You&apos;re all caught up.</p>
      }
      renderRow={(p) => <PaymentRow p={p} />}
    />
  );
}

export function UpcomingPaymentsWidget({ payments }: { payments: DashboardPayment[] }) {
  return (
    <AttentionList
      icon={<Clock className="h-4 w-4 text-primary" />}
      title="Upcoming Payments"
      description="Payments due in the next 30 days."
      items={payments.slice(0, 6)}
      getKey={(p) => p.id}
      emptyState={
        <p className="py-3 text-center text-sm text-muted-foreground">No payments due soon.</p>
      }
      renderRow={(p) => <PaymentRow p={p} />}
    />
  );
}

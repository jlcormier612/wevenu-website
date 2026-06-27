import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
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

export function OverduePaymentsWidget({ payments }: { payments: DashboardPayment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Overdue Payments
          {payments.length > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">{payments.length}</span>
          )}
        </CardTitle>
        <CardDescription>Payments past their due date.</CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">No overdue payments. You&apos;re all caught up.</p>
        ) : (
          <div className="divide-y divide-border">
            {payments.map((p) => <PaymentRow key={p.id} p={p} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UpcomingPaymentsWidget({ payments }: { payments: DashboardPayment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          Upcoming Payments
        </CardTitle>
        <CardDescription>Payments due in the next 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">No payments due soon.</p>
        ) : (
          <div className="divide-y divide-border">
            {payments.slice(0, 6).map((p) => <PaymentRow key={p.id} p={p} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

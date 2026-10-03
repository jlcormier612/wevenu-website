"use client";

import * as React from "react";

import Link from "next/link";
import { DollarSign, Search } from "lucide-react";

import {
  ScheduleStatusBadge,
} from "@/components/payments/payment-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { paymentAttentionReasons } from "@/lib/payments/attention-reasons";
import { formatMoney } from "@/lib/payments/constants";
import {
  PAYMENT_LIST_FILTERS,
  parsePaymentListFilter,
  paymentMatchesListFilter,
  paymentMatchesListSearch,
  type PaymentListFilterKey,
} from "@/lib/payments/list-filters";
import {
  paymentScheduleListPrimaryTitle,
  paymentScheduleListSecondaryLine,
} from "@/lib/payments/list-identity";
import type { PaymentScheduleSummary } from "@/lib/payments/types";

export function PaymentScheduleList({
  schedules,
  initialFilter,
}: {
  schedules: PaymentScheduleSummary[];
  initialFilter?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<PaymentListFilterKey>(
    () => parsePaymentListFilter(initialFilter),
  );

  const filtered = React.useMemo(() => {
    return schedules.filter((s) => {
      if (!paymentMatchesListFilter(s, filter)) return false;
      return paymentMatchesListSearch(s, query);
    });
  }, [schedules, query, filter]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schedules…" className="pl-9" />
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Payment plan filters">
        {PAYMENT_LIST_FILTERS.map(({ value, label }) => {
          const count = schedules.filter((s) => paymentMatchesListFilter(s, value)).length;
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <DollarSign className="h-5 w-5" />
          </span>
          <p className="font-heading text-lg font-medium text-heading">No payment schedules yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground max-w-md">
            A payment schedule is the installment plan for one couple&apos;s invoice.
            Open the Payment Plan Builder from an invoice to choose how that total is collected.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href="/payments/new" />}>+ New schedule from invoice</Button>
          </div>
        </div>
      )}

      {schedules.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No payment plans match your filters.</p>
          <Button
            variant="link"
            size="sm"
            className="mt-1"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Show all
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schedule</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} className="group">
                  <TableCell className="font-medium text-foreground">
                    <Link href={`/payments/${s.id}`} className="hover:text-primary">
                      {paymentScheduleListPrimaryTitle(s)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {paymentScheduleListSecondaryLine(s)}
                    </p>
                    {paymentAttentionReasons(s)
                      .filter((reason) => !reason.includes("overdue"))
                      .map((reason) => (
                      <p key={reason} className="text-xs font-medium text-destructive mt-0.5">
                        {reason}
                      </p>
                    ))}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{formatMoney(s.totalAmount)}</TableCell>
                  <TableCell className="text-sm text-success font-medium">{formatMoney(s.totalPaid)}</TableCell>
                  <TableCell className={`text-sm font-medium ${s.balance > 0 ? "text-foreground" : "text-success"}`}>
                    {s.balance > 0 ? formatMoney(s.balance) : "—"}
                  </TableCell>
                  <TableCell><ScheduleStatusBadge status={s.scheduleStatus} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" render={<Link href={`/payments/${s.id}`} />}>View →</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

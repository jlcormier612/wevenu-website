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
import { formatMoney } from "@/lib/payments/constants";
import type { PaymentScheduleSummary } from "@/lib/payments/types";

export function PaymentScheduleList({ schedules }: { schedules: PaymentScheduleSummary[] }) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    return schedules.filter((s) => !q || [s.title, s.clientName].some((v) => v?.toLowerCase().includes(q)));
  }, [schedules, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schedules…" className="pl-9" />
      </div>

      {schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <DollarSign className="h-5 w-5" />
          </span>
          <p className="font-heading text-lg font-medium text-heading">No payment schedules yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create a payment schedule to start tracking deposits and installments.
          </p>
          <Button render={<Link href="/payments/new" />}>+ New Schedule</Button>
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
                    <Link href={`/payments/${s.id}`} className="hover:text-primary">{s.title}</Link>
                    {s.clientName && (
                      <p className="text-xs text-muted-foreground">{s.clientName}</p>
                    )}
                    {s.overdueCount > 0 && (
                      <p className="text-xs font-medium text-destructive mt-0.5">
                        {s.overdueCount} overdue payment{s.overdueCount > 1 ? "s" : ""}
                      </p>
                    )}
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

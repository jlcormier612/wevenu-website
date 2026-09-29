import type { Metadata } from "next";
import Link from "next/link";

import { PaymentScheduleList } from "@/components/payments/payment-schedule-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getPaymentSchedules } from "@/lib/payments/service";

export const metadata: Metadata = { title: "Payments" };

type Props = { searchParams: Promise<{ filter?: string }> };

export default async function PaymentsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const schedules = await getPaymentSchedules();
  const attentionOnly = filter !== "all";
  const visible = attentionOnly
    ? schedules.filter((s) => s.scheduleStatus === "attention" && !s.excludeFromBusinessReporting)
    : schedules;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={
          attentionOnly
            ? "Schedules that need attention — overdue, refunded, or partially refunded."
            : "Track deposits, installments, and outstanding balances."
        }
        actions={<Button render={<Link href="/payments/new" />}>+ New Schedule</Button>}
      />
      {attentionOnly && (
        <p className="text-sm text-muted-foreground">
          Showing {visible.length} schedule{visible.length === 1 ? "" : "s"} that need attention.
          {" "}
          <Link href="/payments?filter=all" className="text-primary hover:underline">Show all</Link>
        </p>
      )}
      {!attentionOnly && (
        <p className="text-sm text-muted-foreground">
          Showing every schedule.
          {" "}
          <Link href="/payments?filter=attention" className="text-primary hover:underline">Show attention</Link>
        </p>
      )}
      <PaymentScheduleList schedules={visible} />
    </div>
  );
}

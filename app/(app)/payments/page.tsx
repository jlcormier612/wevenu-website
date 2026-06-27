import type { Metadata } from "next";
import Link from "next/link";

import { PaymentScheduleList } from "@/components/payments/payment-schedule-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getPaymentSchedules } from "@/lib/payments/service";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const schedules = await getPaymentSchedules();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Track deposits, installments, and outstanding balances."
        actions={<Button render={<Link href="/payments/new" />}>+ New Schedule</Button>}
      />
      <PaymentScheduleList schedules={schedules} />
    </div>
  );
}

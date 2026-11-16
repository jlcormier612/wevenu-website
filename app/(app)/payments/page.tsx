import type { Metadata } from "next";
import Link from "next/link";

import { PaymentScheduleList } from "@/components/payments/payment-schedule-list";
import {
  PAYMENTS_SPOT_PATTERN_TYPES,
  SpotPatternRecommendationsPanel,
} from "@/components/luv/spot-pattern-recommendations";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getPaymentSchedules } from "@/lib/payments/service";

export const metadata: Metadata = { title: "Payments" };

type Props = { searchParams: Promise<{ filter?: string }> };

export default async function PaymentsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const schedules = await getPaymentSchedules();

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6" data-htc-phase8="payments">
      <SetupHubReturnLink href="/setup-hub/make-htc-yours/booking-process" label="Back to your booking process" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Payments"
          description="Track deposits, installments, and outstanding balances. Filter by status — All includes every payment plan."
          actions={<Button render={<Link href="/payments/new" />}>+ New Schedule</Button>}
        />
      </div>
      <SpotPatternRecommendationsPanel types={PAYMENTS_SPOT_PATTERN_TYPES} />
      <PaymentScheduleList schedules={schedules} initialFilter={filter} />
    </div>
  );
}

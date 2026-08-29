import type { Metadata } from "next";
import Link from "next/link";

import { MilestoneToast } from "@/components/dashboard/milestone-toast";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getDashboardData } from "@/lib/dashboard/service";
import { getVenueHealth } from "@/lib/metrics/health";
import { getBookingsThisMonth } from "@/lib/metrics/booking";
import { getOutstandingBalance, getGrossBookedRevenue } from "@/lib/metrics/revenue";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<{ milestone?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const [data, { milestone }] = await Promise.all([getDashboardData(), searchParams]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground">Dashboard unavailable.</p>
        <Link href="/setup-hub" className="mt-2 text-sm text-primary hover:underline">Return to setup</Link>
      </div>
    );
  }

  const [venueHealth, bookingsThisMonth, outstandingBalance, grossRevenue] = await Promise.all([
    getVenueHealth().catch(() => null),
    getBookingsThisMonth().catch(() => []),
    getOutstandingBalance().catch(() => null),
    getGrossBookedRevenue().catch(() => null),
  ]);

  return (
    <>
      <MilestoneToast milestone={data.nextPendingMilestone} />
      <DashboardOverview
        data={data}
        venueHealthScore={venueHealth?.score ?? null}
        bookingsThisMonth={bookingsThisMonth.length}
        outstandingBalance={outstandingBalance}
        grossRevenue={grossRevenue}
      />
    </>
  );
}

import { BusinessSnapshotSection } from "@/components/dashboard/business-snapshot";
import { getBusinessSnapshot } from "@/lib/dashboard/business-snapshot";
import { forensicTime, withDashboardForensic } from "@/lib/dashboard/forensic-timing";

/** Streams KPI cards independently of Focus / Coming Up assembly. */
export async function DashboardSnapshotIsland() {
  return withDashboardForensic(async () => {
    const snapshot = await forensicTime("business_snapshot", () => getBusinessSnapshot());
    if (!snapshot) return null;
    return <BusinessSnapshotSection cards={snapshot.cards} />;
  });
}

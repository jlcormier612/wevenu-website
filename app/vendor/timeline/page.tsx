import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorTimelineList } from "@/components/vendor-app/vendor-timeline-list";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorTimelineAcrossEvents } from "@/lib/vendor-events/service";

export const metadata: Metadata = { title: "Timeline — Vendor Portal" };

export default async function VendorTimelinePage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const eventsWithTimeline = await getVendorTimelineAcrossEvents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Timeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your run-of-show items, across every event, in one place.</p>
      </div>
      <VendorTimelineList eventsWithTimeline={eventsWithTimeline} />
    </div>
  );
}

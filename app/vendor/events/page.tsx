import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorEventsList } from "@/components/vendor-app/vendor-events-list";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorEvents } from "@/lib/vendor-events/service";

export const metadata: Metadata = { title: "Events — Vendor Portal" };

export default async function VendorEventsPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const events = await getVendorEvents(vendorUser.vendorId);
  return <VendorEventsList events={events} />;
}

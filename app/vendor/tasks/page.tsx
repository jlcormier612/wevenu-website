import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorTasksList } from "@/components/vendor-app/vendor-tasks-list";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorTasks } from "@/lib/vendor-tasks/service";

export const metadata: Metadata = { title: "Tasks — Vendor Portal" };

export default async function VendorTasksPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  // Vendor Workspace Realignment, Phase 6 (2026-07-22): Inquiries (the lead
  // pipeline) dropped from the portal per the Phase 1 audit — a personal
  // task tied to a now-invisible inquiry would dead-end the vendor with no
  // way back to its context, so those rows are excluded here rather than
  // left dangling. The vendor_tasks rows themselves are untouched.
  const tasks = (await getVendorTasks(vendorUser.vendorId)).filter((t) => !t.vendorInquiryId);
  return <VendorTasksList tasks={tasks} />;
}

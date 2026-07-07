import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorTasksList } from "@/components/vendor-app/vendor-tasks-list";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorTasks } from "@/lib/vendor-tasks/service";

export const metadata: Metadata = { title: "Tasks — Vendor Portal" };

export default async function VendorTasksPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const tasks = await getVendorTasks(vendorUser.vendorId);
  return <VendorTasksList tasks={tasks} />;
}

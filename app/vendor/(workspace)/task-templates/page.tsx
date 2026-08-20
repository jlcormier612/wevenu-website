import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorTaskTemplatesManager } from "@/components/vendor-app/vendor-task-templates-manager";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorPackages } from "@/lib/vendor-packages/service";
import { getVendorTaskTemplates } from "@/lib/vendor-task-templates/service";

export const metadata: Metadata = { title: "Task Templates — Vendor Portal" };

export default async function VendorTaskTemplatesPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const [templates, packages] = await Promise.all([
    getVendorTaskTemplates(vendorUser.vendorId),
    getVendorPackages(vendorUser.vendorId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-heading">Task Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Named templates of reusable tasks you can apply to an event. Editing a template later does
          not change tasks already applied to an event.
        </p>
      </div>
      <VendorTaskTemplatesManager templates={templates} packages={packages} />
    </div>
  );
}

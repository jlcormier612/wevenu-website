import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getVendorUser } from "@/lib/vendor-auth/service";

export const metadata: Metadata = { title: "Documents — Vendor Portal" };

export default async function VendorDocumentsPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Documents</h1>
      <p className="text-sm text-muted-foreground">
        Documents shared with you across all events appear here. Open an event to see its specific documents.
      </p>
      <div className="rounded-xl border border-dashed border-border py-14 text-center">
        <p className="text-sm text-muted-foreground">No documents yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Navigate to an event to view shared documents.
        </p>
      </div>
    </div>
  );
}

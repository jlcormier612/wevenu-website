import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorDocumentsList } from "@/components/vendor-app/vendor-documents-list";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorDocumentsAcrossEvents } from "@/lib/vendor-events/service";

export const metadata: Metadata = { title: "Documents — Vendor Portal" };

export default async function VendorDocumentsPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const eventsWithDocs = await getVendorDocumentsAcrossEvents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Everything shared with you, across every event, in one place.</p>
      </div>
      <VendorDocumentsList eventsWithDocs={eventsWithDocs} />
    </div>
  );
}

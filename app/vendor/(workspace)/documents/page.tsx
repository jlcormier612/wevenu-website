import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorDocumentsList } from "@/components/vendor-app/vendor-documents-list";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorLibraryDocuments } from "@/lib/vendor-documents/service";

export const metadata: Metadata = { title: "Document Library — Vendor Portal" };

export default async function VendorDocumentsPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const library = await getVendorLibraryDocuments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-heading">Document Library</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Reusable files you attach to events.
        </p>
      </div>
      <VendorDocumentsList library={library} />
    </div>
  );
}

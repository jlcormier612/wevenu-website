import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { VENDOR_TERMS } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: "Vendor Terms",
  description:
    "Vendor Terms for invited vendors using Hello to Cheers. Draft for counsel review.",
};

export default function VendorTermsPage() {
  return <LegalDocumentView document={VENDOR_TERMS} />;
}

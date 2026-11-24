import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { VENDOR_TERMS } from "@/lib/marketing/legal";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Vendor Terms',
  description:
    'Vendor Terms for invited vendors using Hello to Cheers.',
  path: '/vendor-terms',
});

export default function VendorTermsPage() {
  return <LegalDocumentView document={VENDOR_TERMS} />;
}

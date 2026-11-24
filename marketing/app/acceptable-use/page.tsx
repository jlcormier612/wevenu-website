import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { ACCEPTABLE_USE_POLICY } from "@/lib/marketing/legal";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Acceptable Use Policy',
  description:
    'How Hello to Cheers stays safe, lawful, and trustworthy for hospitality professionals.',
  path: '/acceptable-use',
});

export default function AcceptableUsePage() {
  return <LegalDocumentView document={ACCEPTABLE_USE_POLICY} />;
}

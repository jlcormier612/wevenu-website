import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { PRIVACY_POLICY } from "@/lib/marketing/legal";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Privacy Policy',
  description:
    'How Hello to Cheers collects, uses, and protects information—written for humans first.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}

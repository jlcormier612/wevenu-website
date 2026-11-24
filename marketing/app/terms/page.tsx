import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { TERMS_OF_SERVICE } from "@/lib/marketing/legal";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Venue Subscription Agreement',
  description:
    'Month-to-month terms built to earn your business—not lock you into it.',
  path: '/terms',
});

export default function TermsPage() {
  return <LegalDocumentView document={TERMS_OF_SERVICE} />;
}

import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { END_USER_TERMS } from "@/lib/marketing/legal";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'End User Terms',
  description:
    'Terms for couples, clients, guests, and invited participants using Hello to Cheers.',
  path: '/end-user-terms',
});

export default function EndUserTermsPage() {
  return <LegalDocumentView document={END_USER_TERMS} />;
}

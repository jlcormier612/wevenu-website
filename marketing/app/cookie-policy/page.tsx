import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { COOKIE_POLICY } from "@/lib/marketing/legal";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Cookie Policy',
  description:
    'How Hello to Cheers uses cookies and similar technologies.',
  path: '/cookie-policy',
});

export default function CookiePolicyPage() {
  return <LegalDocumentView document={COOKIE_POLICY} />;
}

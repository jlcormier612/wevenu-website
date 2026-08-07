import type { Metadata } from "next";

import { PublicLegalDocumentPage } from "@/components/legal/public-legal-document";
import { LEGAL_DOCUMENT_TYPE_TITLES } from "@/lib/legal/types";

export const metadata: Metadata = {
  title: LEGAL_DOCUMENT_TYPE_TITLES.cookie_policy,
  description: `Active ${LEGAL_DOCUMENT_TYPE_TITLES.cookie_policy} for Hello to Cheers.`,
};

/** Canonical public Cookie Policy — active version from legal_documents. */
export default function CookiesPage() {
  return <PublicLegalDocumentPage documentType="cookie_policy" />;
}

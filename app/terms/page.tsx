import type { Metadata } from "next";

import { PublicLegalDocumentPage } from "@/components/legal/public-legal-document";
import { LEGAL_DOCUMENT_TYPE_TITLES } from "@/lib/legal/types";

export const metadata: Metadata = {
  title: LEGAL_DOCUMENT_TYPE_TITLES.terms_of_service,
  description: `Active ${LEGAL_DOCUMENT_TYPE_TITLES.terms_of_service} for Hello to Cheers.`,
};

/** Canonical public Venue Subscription Agreement (/terms) — active version from legal_documents. */
export default function TermsPage() {
  return <PublicLegalDocumentPage documentType="terms_of_service" />;
}

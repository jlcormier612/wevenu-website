import type { Metadata } from "next";

import { PublicLegalDocumentPage } from "@/components/legal/public-legal-document";
import { LEGAL_DOCUMENT_TYPE_TITLES } from "@/lib/legal/types";

export const metadata: Metadata = {
  title: LEGAL_DOCUMENT_TYPE_TITLES.couple_end_user_terms,
  description: `Active ${LEGAL_DOCUMENT_TYPE_TITLES.couple_end_user_terms} for Hello to Cheers.`,
};

/** Canonical public End User Terms (/end-user-terms) — active version from legal_documents. */
export default function EndUserTermsPage() {
  return <PublicLegalDocumentPage documentType="couple_end_user_terms" />;
}

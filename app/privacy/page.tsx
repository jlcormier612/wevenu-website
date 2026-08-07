import type { Metadata } from "next";

import { PublicLegalDocumentPage } from "@/components/legal/public-legal-document";
import { LEGAL_DOCUMENT_TYPE_TITLES } from "@/lib/legal/types";

export const metadata: Metadata = {
  title: LEGAL_DOCUMENT_TYPE_TITLES.privacy_policy,
  description: `Active ${LEGAL_DOCUMENT_TYPE_TITLES.privacy_policy} for Hello to Cheers.`,
};

/** Canonical public Privacy Policy — active version from legal_documents. */
export default function PrivacyPage() {
  return <PublicLegalDocumentPage documentType="privacy_policy" />;
}

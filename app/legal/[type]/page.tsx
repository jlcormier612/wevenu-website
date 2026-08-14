import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicLegalDocumentPage } from "@/components/legal/public-legal-document";
import { isLegalDocumentType } from "@/lib/legal/service";
import { LEGAL_DOCUMENT_TYPE_TITLES } from "@/lib/legal/types";

type Props = {
  params: Promise<{ type: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  if (!isLegalDocumentType(type)) {
    return { title: "Legal" };
  }
  return {
    title: LEGAL_DOCUMENT_TYPE_TITLES[type],
    description: `Active ${LEGAL_DOCUMENT_TYPE_TITLES[type]} for Hello to Cheers.`,
  };
}

/**
 * Type-key alias for active legal documents (`/legal/{document_type}`).
 * Canonical public URLs: /terms, /privacy, /cookies, /acceptable-use, /end-user-terms, /vendor-terms.
 */
export default async function LegalDocumentPage({ params }: Props) {
  const { type } = await params;
  if (!isLegalDocumentType(type)) notFound();

  return <PublicLegalDocumentPage documentType={type} />;
}

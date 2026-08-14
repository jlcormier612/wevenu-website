import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { END_USER_TERMS } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: "End User Terms",
  description:
    "Terms for couples, clients, guests, and invited participants using Hello to Cheers. Draft for counsel review.",
};

export default function EndUserTermsPage() {
  return <LegalDocumentView document={END_USER_TERMS} />;
}

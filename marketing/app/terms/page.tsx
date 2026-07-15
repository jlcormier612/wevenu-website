import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { TERMS_OF_SERVICE } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Month-to-month terms built to earn your business—not lock you into it. Draft for counsel review.",
};

export default function TermsPage() {
  return <LegalDocumentView document={TERMS_OF_SERVICE} />;
}

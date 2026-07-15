import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { PRIVACY_POLICY } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Wevenu collects, uses, and protects information—written for humans first.",
};

export default function PrivacyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}

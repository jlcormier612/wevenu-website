import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { ACCEPTABLE_USE_POLICY } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "How Wevenu stays safe, lawful, and trustworthy for hospitality professionals.",
};

export default function AcceptableUsePage() {
  return <LegalDocumentView document={ACCEPTABLE_USE_POLICY} />;
}

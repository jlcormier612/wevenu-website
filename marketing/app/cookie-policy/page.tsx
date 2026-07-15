import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/marketing/legal-document-view";
import { COOKIE_POLICY } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Wevenu uses cookies and similar technologies.",
};

export default function CookiePolicyPage() {
  return <LegalDocumentView document={COOKIE_POLICY} />;
}

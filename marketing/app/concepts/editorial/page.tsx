import type { Metadata } from "next";

import { ConceptSwitcher } from "@/components/marketing/concept-switcher";
import { ConceptEditorial } from "@/components/marketing/concepts/concept-editorial";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Concept A · Editorial Magazine",
};

export default function ConceptEditorialPage() {
  return (
    <>
      <ConceptSwitcher active="editorial" />
      <ConceptEditorial />
    </>
  );
}

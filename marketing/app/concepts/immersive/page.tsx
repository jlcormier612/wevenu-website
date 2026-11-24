import type { Metadata } from "next";

import { ConceptSwitcher } from "@/components/marketing/concept-switcher";
import { ConceptImmersive } from "@/components/marketing/concepts/concept-immersive";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Concept B · Immersive Keynote",
};

export default function ConceptImmersivePage() {
  return (
    <>
      <ConceptSwitcher active="immersive" />
      <ConceptImmersive />
    </>
  );
}

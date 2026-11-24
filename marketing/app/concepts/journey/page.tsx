import type { Metadata } from "next";

import { ConceptSwitcher } from "@/components/marketing/concept-switcher";
import { ConceptJourney } from "@/components/marketing/concepts/concept-journey";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Concept C · Interactive Booking Journey",
};

export default function ConceptJourneyPage() {
  return (
    <>
      <ConceptSwitcher active="journey" />
      <ConceptJourney />
    </>
  );
}

import type { Metadata } from "next";

import { PricingTiers } from "@/components/marketing/sections/pricing-tiers";
import { CtaBand } from "@/components/marketing/sections/cta-band";

export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return (
    <>
      <PricingTiers />
      <CtaBand
        headline="Ready when you are"
        body="Request a walkthrough to discuss the plan that fits your venue."
      />
    </>
  );
}

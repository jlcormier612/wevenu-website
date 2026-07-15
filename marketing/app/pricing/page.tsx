import type { Metadata } from "next";

import { PricingExperience } from "@/components/marketing/pricing-experience";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple monthly pricing for Wevenu—every feature included. The only difference is how many celebrations you host each year.",
};

type PricingSearchParams = Promise<{ canceled?: string }>;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: PricingSearchParams;
}) {
  const params = await searchParams;
  return <PricingExperience canceled={params.canceled === "1"} />;
}

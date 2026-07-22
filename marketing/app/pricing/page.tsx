import type { Metadata } from "next";

import { PricingExperience } from "@/components/marketing/pricing-experience";
import { getEnrollmentConfig } from "@/lib/marketing/enrollment";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple monthly pricing for Hello to Cheers—every feature included. The only difference is how many celebrations you host each year.",
};

type PricingSearchParams = Promise<{ canceled?: string }>;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: PricingSearchParams;
}) {
  const params = await searchParams;
  const enrollment = getEnrollmentConfig();
  return (
    <PricingExperience canceled={params.canceled === "1"} enrollment={enrollment} />
  );
}

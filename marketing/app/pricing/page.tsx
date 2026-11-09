import type { Metadata } from "next";

import { PricingExperience } from "@/components/marketing/pricing-experience";
import { getEnrollmentConfigAsync } from "@/lib/marketing/enrollment";
import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple monthly pricing for Hello to Cheers—every feature included. The only difference is how many celebrations you host each year.",
};

type PricingSearchParams = Promise<{
  canceled?: string;
  reservation_id?: string;
  plan?: string;
  venue_name?: string;
  add_venue?: string;
}>;

function asPlanId(value: string | undefined): SubscriptionPlanId | null {
  if (value === "starter" || value === "growing" || value === "professional") {
    return value;
  }
  return null;
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: PricingSearchParams;
}) {
  const params = await searchParams;
  const enrollment = await getEnrollmentConfigAsync();
  return (
    <PricingExperience
      canceled={params.canceled === "1"}
      enrollment={enrollment}
      organizationReservationId={params.reservation_id?.trim() || null}
      preferredPlanId={asPlanId(params.plan)}
      prefillVenueName={params.venue_name?.trim() || null}
      addVenue={params.add_venue === "1"}
    />
  );
}

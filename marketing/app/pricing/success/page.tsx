import type { Metadata } from "next";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { PricingPortalButton } from "@/components/marketing/pricing-checkout-button";
import { TYPE_HERO_SHELL, TYPE_LABEL } from "@/lib/marketing/rhythm";

export const metadata: Metadata = {
  title: "Welcome to Hello to Cheers",
  description: "Your Hello to Cheers subscription is ready.",
};

type SuccessSearchParams = Promise<{ session_id?: string }>;

export default async function PricingSuccessPage({
  searchParams,
}: {
  searchParams: SuccessSearchParams;
}) {
  const params = await searchParams;
  const sessionId = params.session_id?.trim() || null;

  return (
    <div className={`bg-[var(--true-white)] ${TYPE_HERO_SHELL}`}>
      <div className="mx-auto max-w-xl text-center">
        <p className={TYPE_LABEL}>You&apos;re in</p>
        <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
          Welcome to Hello to Cheers
        </h1>
        <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
          Your subscription is active. Manage billing anytime through the Stripe Customer
          Portal—update payment methods, view invoices, or cancel when you need to.
        </p>
        <div className="mt-12 flex flex-col items-center gap-4">
          {sessionId ? (
            <PricingPortalButton sessionId={sessionId} />
          ) : (
            <MarketingCta href="/pricing" label="Back to pricing" variant="secondary" />
          )}
        </div>
      </div>
    </div>
  );
}

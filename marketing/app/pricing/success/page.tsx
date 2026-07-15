import type { Metadata } from "next";
import Link from "next/link";

import { PricingPortalButton } from "@/components/marketing/pricing-checkout-button";

export const metadata: Metadata = {
  title: "Welcome to Wevenu",
  description: "Your Wevenu subscription is ready.",
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
    <div className="bg-[var(--true-white)] px-6 pt-[140px] pb-32">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
          You&apos;re in
        </p>
        <h1 className="mt-6 font-heading text-4xl font-medium text-[var(--forest-sage)] md:text-5xl">
          Welcome to Wevenu.
        </h1>
        <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
          Your subscription is active. Manage billing anytime through the Stripe Customer
          Portal—update payment methods, view invoices, or cancel when you need to.
        </p>
        <div className="mt-12 flex flex-col items-center gap-4">
          {sessionId ? (
            <PricingPortalButton sessionId={sessionId} />
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full bg-[var(--heritage-sage)] px-6 py-3 text-sm tracking-wide text-[var(--true-white)] transition-opacity hover:opacity-90"
            >
              Back to pricing
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";

import { activationUrlFromToken } from "@shared/email";
import { getEnrollmentBySession } from "@shared/product-account";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { PricingPortalButton } from "@/components/marketing/pricing-checkout-button";
import { TYPE_HERO_SHELL, TYPE_LABEL } from "@/lib/marketing/rhythm";

export const metadata: Metadata = {
  title: "Welcome to Hello to Cheers",
  description: "Your Hello to Cheers subscription is ready.",
};

export const dynamic = "force-dynamic";

type SuccessSearchParams = Promise<{ session_id?: string }>;

function productAppLoginUrl(): string {
  const base = (process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/login`;
}

/**
 * What happened is a real Stripe subscription purchase — this page's job
 * is to tell the customer exactly what happens next, not just confirm
 * billing. Looks the enrollment back up by the same session_id Stripe
 * puts on the redirect, so the primary action reflects what actually
 * happened (self-setup gets a direct Activate link identical to the one
 * already in their welcome email; white_glove gets "we'll reach out";
 * an enrollment not found yet — webhook lag — gets a safe holding state).
 * Billing/Customer Portal access is preserved but demoted to a secondary
 * action; a brand-new customer's primary next step is never "manage billing."
 */
export default async function PricingSuccessPage({
  searchParams,
}: {
  searchParams: SuccessSearchParams;
}) {
  const params = await searchParams;
  const sessionId = params.session_id?.trim() || null;

  const lookup = sessionId ? await getEnrollmentBySession(sessionId) : null;
  const enrollment = lookup?.ok && lookup.found ? lookup : null;

  let heading = "Welcome to Hello to Cheers";
  let body =
    "Your subscription is active. We're setting up your venue account now — this usually only takes a moment.";
  let primaryCta: { href: string; label: string } | null = null;

  if (enrollment) {
    if (enrollment.status === "activated") {
      heading = "You're already set up";
      body = "Your account is active. Sign in to pick up right where you left off.";
      primaryCta = { href: productAppLoginUrl(), label: "Sign in" };
    } else if (enrollment.onboardingType === "white_glove") {
      heading = "Welcome to Hello to Cheers";
      body =
        "Your subscription is active and your White Glove setup has started. A member of our team will reach out within one business day to get your venue set up — no action needed from you right now.";
    } else if (enrollment.activationToken) {
      heading = "You're almost in";
      body =
        "Your subscription is active. Activate your account now to set your password and get started — we've also emailed you this same link.";
      primaryCta = {
        href: activationUrlFromToken(enrollment.activationToken),
        label: "Activate your account",
      };
    }
  } else if (sessionId) {
    // Found no row yet — the checkout.session.completed webhook can land a
    // few seconds after the browser redirect. Not an error state.
    body =
      "Your subscription is active. We're finishing setting up your venue account — check your email in the next few minutes for your activation link.";
  }

  return (
    <div className={`bg-[var(--true-white)] ${TYPE_HERO_SHELL}`}>
      <div className="mx-auto max-w-xl text-center">
        <p className={TYPE_LABEL}>You&apos;re in</p>
        <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
          {heading}
        </h1>
        <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
          {body}
        </p>
        <div className="mt-12 flex flex-col items-center gap-4">
          {primaryCta ? (
            <MarketingCta href={primaryCta.href} label={primaryCta.label} variant="primary" />
          ) : null}
          <div className={primaryCta ? "mt-4" : undefined}>
            {sessionId ? (
              <>
                {primaryCta ? (
                  <p className="text-sm text-[var(--forest-sage)]/50">
                    Need to update your billing details instead?
                  </p>
                ) : null}
                <PricingPortalButton
                  sessionId={sessionId}
                  label="Manage billing"
                  className={primaryCta ? "mt-2 border-transparent bg-transparent px-0 py-1 text-sm text-[var(--forest-sage)]/55 underline underline-offset-4 hover:bg-transparent" : undefined}
                />
              </>
            ) : (
              <MarketingCta href="/pricing" label="Back to pricing" variant="secondary" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

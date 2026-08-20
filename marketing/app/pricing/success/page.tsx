import type { Metadata } from "next";

import { activationUrlFromToken } from "@shared/email";
import { getEnrollmentBySession } from "@shared/product-account";
import { MarketingCta } from "@/components/marketing/marketing-cta";
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
 * Post-purchase welcome. Enrollment lookup is unchanged: self-guided
 * customers get the activation URL behind "Get started"; white_glove and
 * already-activated keep their existing functional states. Billing and
 * return-to-pricing are not shown on this page.
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

  const isNormalSelfGuidedWelcome = Boolean(
    enrollment &&
      enrollment.status !== "activated" &&
      enrollment.onboardingType !== "white_glove" &&
      enrollment.activationToken,
  );

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
      primaryCta = {
        href: activationUrlFromToken(enrollment.activationToken),
        label: "Get started",
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
        {isNormalSelfGuidedWelcome && primaryCta ? (
          <>
            <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
              Welcome to Hello to Cheers
            </h1>
            <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              We&apos;re so glad you&apos;re here.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              Your membership is active, and your Hello to Cheers experience is
              ready to begin. Let&apos;s get your account set up and then
              we&apos;ll walk you through everything we&apos;ve built to make
              running your venue feel a little easier — and a lot more like you.
            </p>
            <div className="mt-12 flex flex-col items-center">
              <MarketingCta href={primaryCta.href} label={primaryCta.label} variant="primary" />
              <p className="mt-6 max-w-md text-sm leading-[1.7] text-[var(--forest-sage)]/55">
                We&apos;ll start with a few simple things about your venue. You
                can take it from there, at your own pace.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
              {heading}
            </h1>
            <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              {body}
            </p>
            {primaryCta ? (
              <div className="mt-12 flex flex-col items-center">
                <MarketingCta href={primaryCta.href} label={primaryCta.label} variant="primary" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";

import { activationUrlFromToken, whiteGloveIntakeUrlFromToken } from "@shared/email";
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
  const base = (process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/login`;
}

/**
 * Post-purchase welcome.
 * Self-Setup → activation CTA.
 * White Glove → intake CTA (no product access yet).
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

  const isSelfSetupWelcome = Boolean(
    enrollment &&
      enrollment.status !== "activated" &&
      enrollment.onboardingType !== "white_glove" &&
      enrollment.activationToken,
  );

  const isWhiteGloveWelcome = Boolean(
    enrollment && enrollment.onboardingType === "white_glove" && enrollment.status !== "activated",
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
      heading = "Let's get your venue ready";
      body =
        "You've chosen White Glove Setup. We'll build your Hello to Cheers workspace using the information and materials you provide. You don't need to configure everything yourself.";
      if (enrollment.intakeToken) {
        primaryCta = {
          href: whiteGloveIntakeUrlFromToken(enrollment.intakeToken),
          label: "Continue",
        };
      }
    } else if (enrollment.activationToken) {
      primaryCta = {
        href: activationUrlFromToken(enrollment.activationToken),
        label: "Get started",
      };
    }
  } else if (sessionId) {
    body =
      "Your subscription is active. We're finishing setting up your venue account — check your email in the next few minutes for your next step.";
  }

  return (
    <div className={`bg-[var(--true-white)] ${TYPE_HERO_SHELL}`}>
      <div className="mx-auto max-w-xl text-center">
        <p className={TYPE_LABEL}>You&apos;re in</p>
        {isSelfSetupWelcome && primaryCta ? (
          <>
            <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
              Welcome to Hello to Cheers
            </h1>
            <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              We&apos;re so glad you&apos;re here.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              Your membership is active, and your Hello to Cheers experience is ready to begin.
              Let&apos;s get your account set up and then we&apos;ll walk you through everything
              we&apos;ve built to make running your venue feel a little easier — and a lot more
              like you.
            </p>
            <div className="mt-12 flex flex-col items-center">
              <MarketingCta href={primaryCta.href} label={primaryCta.label} variant="primary" />
              <p className="mt-6 max-w-md text-sm leading-[1.7] text-[var(--forest-sage)]/55">
                We&apos;ll start with a few simple things about your venue. You can take it from
                there, at your own pace.
              </p>
            </div>
          </>
        ) : isWhiteGloveWelcome ? (
          <>
            <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
              {heading}
            </h1>
            <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              {body}
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              We&apos;ll let you know if we need you to make a decision we can&apos;t make for
              you.
            </p>
            <p className="mt-5 text-sm leading-[1.7] text-[var(--forest-sage)]/55">
              Every venue is a little different. We&apos;ll get started as soon as we have what we
              need and keep you updated along the way. The sooner you send your materials and
              answer any questions, the sooner we&apos;ll have your workspace ready to use.
            </p>
            {primaryCta ? (
              <div className="mt-12 flex flex-col items-center">
                <MarketingCta href={primaryCta.href} label={primaryCta.label} variant="primary" />
              </div>
            ) : null}
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

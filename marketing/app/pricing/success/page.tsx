import type { Metadata } from "next";

import {
  activationUrlFromToken,
  productPostActivationLoginUrl,
  whiteGloveIntakeUrlFromToken,
} from "@shared/email";
import { getEnrollmentBySession } from "@shared/product-account";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { SuccessPendingRefresh } from "@/components/pricing/success-pending-refresh";
import {
  classifySuccessEnrollment,
  waitForEnrollmentBySession,
} from "@/lib/pricing/wait-for-enrollment";
import { reconcilePaidCheckoutSession } from "@/lib/stripe/reconcile-paid-checkout";
import { TYPE_HERO_SHELL, TYPE_LABEL } from "@/lib/marketing/rhythm";

export const metadata: Metadata = {
  title: "Welcome to Hello to Cheers",
  description: "Your Hello to Cheers subscription is ready.",
};

export const dynamic = "force-dynamic";

type SuccessSearchParams = Promise<{ session_id?: string }>;

/**
 * Post-purchase welcome.
 * Self-Setup → activation CTA (only after enrollment is available).
 * White Glove → intake CTA (no product access yet).
 *
 * Bounded server retries cover the normal Checkout → webhook gap. When the
 * webhook is still late, a trusted Stripe Session re-read may run the same
 * idempotent enrollment path the webhook uses — never the success URL alone.
 * Soft client refresh continues while still processing.
 */
export default async function PricingSuccessPage({
  searchParams,
}: {
  searchParams: SuccessSearchParams;
}) {
  const params = await searchParams;
  const sessionId = params.session_id?.trim() || null;

  let outcome = await waitForEnrollmentBySession(sessionId, {
    attempts: 8,
    delayMs: 500,
    lookup: getEnrollmentBySession,
  });

  let paymentActionRequired = false;

  // Webhook may still be in flight after Checkout redirect. Re-read Stripe
  // (never the success URL alone) and run the same idempotent enrollment path.
  if (outcome.status === "pending" && sessionId) {
    try {
      const reconciled = await reconcilePaidCheckoutSession(sessionId);
      if (
        reconciled.ok &&
        (reconciled.status === "reconciled" ||
          reconciled.status === "already_enrolled")
      ) {
        outcome = await waitForEnrollmentBySession(sessionId, {
          attempts: 4,
          delayMs: 400,
          lookup: getEnrollmentBySession,
        });
      } else if (reconciled.ok && reconciled.status === "not_eligible") {
        // Checkout success URL without paid/active Stripe state — do not
        // keep the owner in an infinite "confirming" loop.
        paymentActionRequired = true;
      }
    } catch (error) {
      console.warn("[pricing/success] Stripe reconcile skipped", error);
    }
  }

  const view = classifySuccessEnrollment(outcome);
  const enrollment =
    outcome.status === "found" ? outcome.enrollment : null;

  const isSelfSetupWelcome = view === "self_setup_ready";
  const isWhiteGloveWelcome = view === "white_glove_ready";
  const isProcessing = view === "processing" && !paymentActionRequired;
  const isMissingSession = view === "missing_session";

  let heading = "Welcome to Hello to Cheers";
  let body =
    "Your subscription is active. We're setting up your venue account now — this usually only takes a moment.";
  let primaryCta: { href: string; label: string } | null = null;

  if (view === "already_activated" && enrollment) {
    heading = "You're already set up";
    body =
      "Your account is active. Sign in with the email from this purchase to open your venue — not a different account that may already be signed in on this device.";
    primaryCta = {
      href: productPostActivationLoginUrl(enrollment.ownerEmail),
      label: "Sign in",
    };
  } else if (view === "white_glove_ready" && enrollment) {
    heading = "Let's get your venue ready";
    body =
      "Your subscription and White Glove onboarding purchase are confirmed. We'll help build your Hello to Cheers workspace using the information and materials you provide — you don't need to configure everything yourself.";
    if (enrollment.intakeToken) {
      primaryCta = {
        href: whiteGloveIntakeUrlFromToken(enrollment.intakeToken),
        label: "Share your venue information",
      };
    }
  } else if (view === "self_setup_ready" && enrollment?.activationToken) {
    primaryCta = {
      href: activationUrlFromToken(enrollment.activationToken),
      label: "Get started",
    };
  } else if (paymentActionRequired) {
    heading = "Let's finish your subscription";
    body =
      "We couldn't complete your subscription. Your setup is saved, so you can pick up right where you left off.";
    primaryCta = {
      href: "/pricing#plans",
      label: "Return to pricing",
    };
  } else if (isProcessing && sessionId) {
    body =
      "Your subscription is being confirmed. Your venue setup is saved, and we'll have you on your way shortly.";
  } else if (isMissingSession) {
    body =
      "If you just completed checkout, open the link from your confirmation email to continue. If you need help, reply to that email and we'll take care of you.";
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
              Your next step is to share a few details about your venue. There&apos;s nothing to
              schedule right now — we&apos;ll reach out personally when we need anything from you.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              You won&apos;t sign in yet. We&apos;ll invite you when your workspace is ready. There
              is no Setup Hub for you to complete on your own.
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
            ) : (
              <SuccessPendingRefresh sessionId={sessionId} />
            )}
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
            {isProcessing && sessionId ? (
              <SuccessPendingRefresh sessionId={sessionId} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

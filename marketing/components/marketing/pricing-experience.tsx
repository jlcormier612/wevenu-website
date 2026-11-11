import Link from "next/link";

import {
  HospitalityHeart,
  TrustRule,
} from "@/components/marketing/brand-accents";
import { PricingCheckoutButton } from "@/components/marketing/pricing-checkout-button";
import { SignatureClosingCta } from "@/components/marketing/signature-closing-cta";
import {
  getEnrollmentConfig,
  isFounderPricingActive,
  type EnrollmentConfig,
} from "@/lib/marketing/enrollment";
import {
  getPricingDisplayState,
  type SubscriptionPlanId,
} from "@/lib/marketing/pricing-page";
import {
  HEADING_AFTER_EYEBROW,
  TYPE_BODY,
  TYPE_HERO_SHELL,
  TYPE_LABEL,
  TYPE_MEASURE,
  TYPE_TITLE_TO_BODY,
} from "@/lib/marketing/rhythm";
import { isPricingWevenV1Ready } from "@shared/pricing";
import { cn } from "@/lib/utils";

/** Approved HTC tokens — headings sage; body dark ink on light surfaces. */
const HEADING = "text-[var(--forest-sage)]";
const BODY = "text-[rgba(36,51,43,0.88)]";
const BODY_SOFT = "text-[var(--forest-sage)]/75";
const CTA_PRIMARY =
  "bg-[var(--botanical)] text-[var(--true-white)] hover:bg-[color-mix(in_srgb,var(--botanical)_88%,black)]";
const CTA_FOCUS =
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--botanical)]";

/**
 * Pricing experience — V1 catalog, Founding / Weven / multi-venue clarity,
 * guided setup, FAQ, and Walkthrough closing CTA.
 */
export function PricingExperience({
  canceled,
  enrollment = getEnrollmentConfig(),
  organizationReservationId = null,
  preferredPlanId = null,
  prefillVenueName = null,
  addVenue = false,
}: {
  canceled?: boolean;
  enrollment?: EnrollmentConfig;
  organizationReservationId?: string | null;
  preferredPlanId?: SubscriptionPlanId | null;
  prefillVenueName?: string | null;
  addVenue?: boolean;
}) {
  const display = getPricingDisplayState();
  const page = display.page;
  const checkoutAvailable = display.checkoutAvailable;
  const wevenOfferAvailable = isPricingWevenV1Ready();
  // Founding amounts/copy are marketing-visible while the soft-100 program is
  // open — independent of Stripe Checkout readiness (fail-closed purchase path).
  const founderActive = isFounderPricingActive(enrollment);
  const spots = enrollment.founderSpotsRemaining;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Introduction + plans: one continuous soft beige band ── */}
      <div className="bg-[var(--header-linen)]">
      <section
        className={TYPE_HERO_SHELL}
        aria-labelledby="pricing-intro-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <TrustRule className="mx-auto mb-4 md:mb-5" />
          <p className={TYPE_LABEL}>PRICING</p>
          <h1
            id="pricing-intro-heading"
            className={`${HEADING_AFTER_EYEBROW} font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight ${HEADING} md:text-[3.36rem] lg:text-[3.4rem] text-balance`}
          >
            {page.hero.headline}
          </h1>
          <p
            className={`${TYPE_TITLE_TO_BODY} mx-auto ${TYPE_BODY} ${BODY} ${TYPE_MEASURE}`}
          >
            {page.hero.body}
          </p>
          {addVenue ? (
            <p className="mt-8 text-sm tracking-wide text-[var(--heritage-sage)]">
              Adding another property
              {prefillVenueName ? ` — ${prefillVenueName}` : ""}. Choose a plan
              below; additional-venue pricing is applied when you qualify.
            </p>
          ) : null}
          {canceled ? (
            <p className={`mt-8 text-sm tracking-wide ${BODY_SOFT}`}>
              Checkout was canceled. Your plan choices are still here whenever
              you&apos;re ready.
            </p>
          ) : null}
          {!checkoutAvailable ? (
            <p className={`mt-8 text-sm tracking-wide ${BODY_SOFT}`}>
              Online checkout is temporarily unavailable while we finish pricing
              configuration. Please contact us if you need help enrolling.
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Plans (3 cards) ── */}
      <section
        id="plans"
        className="scroll-mt-28 px-6 pb-16 pt-2 md:pb-20"
      >
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {page.plans.map((plan) => {
            const emphasized = plan.id === "growing";
            return (
              <article
                key={plan.id}
                data-pricing-section="plan-card"
                className={cn(
                  "flex flex-col rounded-[2rem] border bg-[var(--true-white)] px-7 py-10 shadow-[0_22px_48px_-36px_rgba(47,55,47,0.28)] md:px-8 md:py-12",
                  emphasized
                    ? "border-[var(--botanical)]/40 ring-1 ring-[var(--botanical)]/25"
                    : "border-[var(--taupe-light)]",
                )}
              >
                <h2 className={`font-heading text-[2.1rem] ${HEADING}`}>
                  {plan.name}
                </h2>
                <p className={`mt-3 text-sm leading-[1.7] ${BODY_SOFT}`}>
                  {plan.capacity}
                </p>
                <div className="mt-10 flex-1">
                  {founderActive ? (
                    <>
                      <p className={`text-sm tracking-wide ${BODY_SOFT}`}>
                        Regular: {plan.price}
                        {plan.period}
                      </p>
                      <p
                        className={`mt-4 font-heading text-4xl ${HEADING} md:text-5xl`}
                      >
                        {plan.foundingPrice}
                        <span className={`ml-1 text-lg ${BODY_SOFT}`}>
                          {plan.period}
                        </span>
                      </p>
                      <p className="mt-4 text-sm tracking-wide text-[var(--heritage-sage)]">
                        {page.founderPricing.label}
                      </p>
                      <p className={`mt-2 text-xs leading-relaxed ${BODY_SOFT}`}>
                        {page.founderPricing.discountNote}
                      </p>
                    </>
                  ) : (
                    <p className={`font-heading text-4xl ${HEADING} md:text-5xl`}>
                      {plan.price}
                      <span className={`ml-1 text-lg ${BODY_SOFT}`}>
                        {plan.period}
                      </span>
                    </p>
                  )}
                </div>
                <div className="mt-10">
                  {checkoutAvailable ? (
                    <PricingCheckoutButton
                      planId={plan.id}
                      label={
                        preferredPlanId && plan.id === preferredPlanId
                          ? "Continue with this plan"
                          : plan.cta
                      }
                      variant="primary"
                      wevenOfferAvailable={wevenOfferAvailable}
                      organizationReservationId={organizationReservationId}
                      prefillVenueName={prefillVenueName}
                    />
                  ) : (
                    <Link
                      href="/contact"
                      className={cn(
                        "inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm tracking-wide transition duration-200 ease-out",
                        CTA_FOCUS,
                        CTA_PRIMARY,
                      )}
                    >
                      Contact us to get started
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-3xl text-center">
          <p className={`text-base leading-[1.7] ${BODY} md:text-lg`}>
            {page.multiVenue.headline} {page.multiVenue.body}
          </p>
        </div>
      </section>
      </div>

      {/* ── Everything included ── */}
      <section
        data-pricing-section="included"
        className="border-y border-[var(--taupe-medium)]/40 bg-[var(--true-white)] px-6 py-24 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <h2
            className={`font-heading text-[2.1rem] ${HEADING} md:text-[3.36rem] text-balance`}
          >
            {page.included.headline}
          </h2>
          <p
            className={`mt-6 max-w-[65ch] text-base leading-[1.7] ${BODY} md:text-lg`}
          >
            {page.included.intro}
          </p>
          <ul className="mt-12 grid gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {page.included.features.map((feature) => (
              <li
                key={feature}
                className={`flex items-baseline gap-3 text-base ${BODY} md:text-lg`}
              >
                <span
                  className="shrink-0 font-heading text-lg leading-none text-[var(--botanical)]"
                  aria-hidden
                >
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p
            className={`mx-auto mt-14 max-w-[42rem] text-center text-base leading-[1.7] ${BODY} md:mt-16 md:text-lg`}
          >
            {page.included.supportingLine}
          </p>
        </div>
      </section>

      {/* ── Founding Membership ── */}
      {founderActive ? (
        <section
          data-pricing-section="founding"
          className="relative overflow-hidden bg-[var(--botanical)] px-6 py-24 md:py-28"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[color-mix(in_srgb,var(--warm-canvas)_28%,transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-3xl">
            <span
              className="mb-6 block h-px w-11 bg-[color-mix(in_srgb,var(--warm-canvas)_55%,transparent)]"
              aria-hidden
            />
            <h2 className="font-heading text-[2.1rem] text-[var(--warm-canvas)] md:text-[3.36rem]">
              {page.foundingMembership.headline}
            </h2>
            <div className="mt-8 max-w-[65ch] space-y-5 text-base leading-[1.7] text-[color-mix(in_srgb,var(--warm-canvas)_92%,transparent)] md:text-lg">
              {page.foundingMembership.intro(spots).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <p className="mt-12 text-sm tracking-wide text-[color-mix(in_srgb,var(--warm-canvas)_78%,transparent)]">
              {page.foundingMembership.receivesLabel}
            </p>
            <ul className="mt-6 space-y-4">
              {page.foundingMembership.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex max-w-[65ch] items-baseline gap-3 text-base leading-[1.7] text-[color-mix(in_srgb,var(--warm-canvas)_92%,transparent)] md:text-lg"
                >
                  <span
                    className="shrink-0 font-heading text-lg leading-none text-[var(--blush)]"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ── Former Weven ── */}
      <section
        data-pricing-section="weven"
        className="bg-[color-mix(in_srgb,var(--blush)_55%,var(--warm-canvas))] px-6 py-24 md:py-28"
      >
        <div className="mx-auto max-w-[36rem] text-center md:max-w-[40rem]">
          <p className={TYPE_LABEL}>{page.welcomeBack.eyebrow}</p>
          <h2
            className={`${HEADING_AFTER_EYEBROW} font-heading text-[2.1rem] leading-[1.18] tracking-tight ${HEADING} md:text-[3rem] md:leading-[1.16] text-balance`}
          >
            {page.welcomeBack.headline}
          </h2>
          <div
            className={`mt-8 space-y-5 text-base leading-[1.7] ${BODY} md:text-lg`}
          >
            {page.welcomeBack.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p
            className={`mt-10 font-heading text-xl leading-snug tracking-tight text-[var(--botanical)] md:text-2xl text-balance`}
          >
            <HospitalityHeart className="mr-2 inline-block align-[-0.1em] text-[var(--dusty-rose)]" />
            {page.welcomeBack.thankYou}
          </p>
          <div
            className={`mt-6 space-y-3 text-base leading-[1.7] ${BODY} md:text-lg`}
          >
            {page.welcomeBack.note.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="mt-8">
            <Link
              href="#plans"
              className={`font-heading text-xl ${HEADING} underline-offset-8 hover:underline md:text-2xl`}
            >
              Choose a plan →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Getting Started ── */}
      <section
        data-pricing-section="setup"
        className="border-t border-[var(--taupe-medium)]/40 bg-[var(--true-white)] px-6 py-24 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className={`font-heading text-[2.1rem] ${HEADING} md:text-[3.36rem] text-balance`}
            >
              {page.gettingStarted.headline}
            </h2>
            <div
              className={`mx-auto mt-6 max-w-[40rem] space-y-4 text-base leading-[1.7] ${BODY} md:text-lg`}
            >
              {page.gettingStarted.intro.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className="mt-14 grid items-stretch gap-6 md:mt-16 md:grid-cols-2">
            {page.gettingStarted.cards.map((card) => (
              <article
                key={card.title}
                className="flex h-full flex-col rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--warm-canvas)] px-7 py-10 shadow-[0_22px_48px_-36px_rgba(47,55,47,0.22)] md:px-8 md:py-12"
              >
                <p className={TYPE_LABEL}>{card.eyebrow}</p>
                <h3 className={`mt-4 font-heading text-3xl ${HEADING}`}>
                  {card.title}
                </h3>
                <p
                  className={`mt-10 font-heading text-4xl ${HEADING} md:text-5xl`}
                >
                  {card.price}
                </p>
                {"wevenPrice" in card && card.wevenPrice ? (
                  <p className={`mt-3 text-sm ${BODY_SOFT}`}>{card.wevenPrice}</p>
                ) : null}
                <div
                  className={`mt-6 max-w-[65ch] space-y-2 text-base leading-[1.7] ${BODY} md:text-lg`}
                >
                  {card.lead.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        data-pricing-section="faq"
        className="border-t border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-24 md:py-28"
      >
        <div className="mx-auto max-w-3xl">
          <h2
            className={`font-heading text-[2.1rem] ${HEADING} md:text-[3.36rem]`}
          >
            Questions we hear most
          </h2>
          <dl className="mt-12 space-y-10">
            {page.faq.map((item) => (
              <div key={item.question}>
                <dt className={`font-heading text-xl ${HEADING} md:text-2xl`}>
                  {item.question}
                </dt>
                <dd className={`mt-3 text-base leading-[1.7] ${BODY} md:text-lg`}>
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
          <p
            className={`mx-auto mt-14 max-w-[36rem] text-center text-sm leading-[1.7] ${BODY} md:mt-16 md:text-base`}
          >
            Prefer to talk it through?{" "}
            <Link
              href="/contact"
              className="font-medium text-[var(--botanical)] underline underline-offset-4 decoration-[color-mix(in_srgb,var(--botanical)_55%,transparent)] transition-colors duration-200 ease-out hover:decoration-[var(--botanical)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
            >
              Contact us
            </Link>{" "}
            anytime — we&apos;re happy to help.
          </p>
        </div>
      </section>

      <div data-pricing-section="closing">
        <SignatureClosingCta
          headline={page.closing.headline}
          body={page.closing.lines}
          bodyVariant="lines"
          surface="botanical"
          primaryLabel={page.closing.cta}
        />
      </div>
    </div>
  );
}

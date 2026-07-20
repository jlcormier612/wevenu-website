import Link from "next/link";

import { OurFirstFriends } from "@/components/marketing/our-first-friends";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { PricingCheckoutButton } from "@/components/marketing/pricing-checkout-button";
import { PRICING_PAGE } from "@/lib/marketing/pricing-page";
import { TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

/**
 * Editorial Pricing experience — calm hospitality catalog, Stripe Checkout underneath.
 */
export function PricingExperience({ canceled }: { canceled?: boolean }) {
  const page = PRICING_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Hero ── */}
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <h1 className="font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
            {page.hero.headline}
          </h1>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
            {page.hero.lines.map((line) => (
              <p key={line}>
                {line}
              </p>
            ))}
          </div>
          {canceled ? (
            <p className="mt-10 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Checkout was canceled. Your plan choices are still here whenever you&apos;re ready.
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {page.plans.map((plan) => (
            <article
              key={plan.id}
              className="flex flex-col border border-[var(--taupe-medium)]/50 bg-[var(--linen)]/40 px-7 py-10 md:px-8 md:py-12"
            >
              <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)]">{plan.name}</h2>
              <p className="mt-3 text-sm leading-[1.7] text-[var(--forest-sage)]/60">
                {plan.capacity}
              </p>
              <div className="mt-10 flex-1">
                {plan.kind === "subscription" && plan.price ? (
                  <p className="font-heading text-4xl text-[var(--forest-sage)] md:text-5xl">
                    {plan.price}
                    <span className="ml-1 text-lg text-[var(--forest-sage)]/50">{plan.period}</span>
                  </p>
                ) : (
                  <p className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
                    {plan.priceLabel}
                  </p>
                )}
              </div>
              <div className="mt-10">
                {plan.kind === "subscription" ? (
                  <PricingCheckoutButton
                    planId={plan.id}
                    label={plan.cta}
                    variant={plan.id === "growing" ? "primary" : "secondary"}
                  />
                ) : (
                  <MarketingCta
                    href="/contact"
                    label={plan.cta}
                    variant="secondary"
                    className="w-full"
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Included ── */}
      <section className="border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            {page.included.headline}
          </h2>
          <ul className="mt-14 grid gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {page.included.features.map((feature) => (
              <li
                key={feature}
                className="flex items-baseline gap-3 text-base text-[var(--forest-sage)]/85 md:text-lg"
              >
                <span
                  className="shrink-0 font-heading text-lg leading-none text-[var(--heritage-sage)]"
                  aria-hidden
                >
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p className="mt-14 max-w-2xl font-heading text-xl leading-snug text-[var(--forest-sage)] md:text-2xl">
            {page.included.note}
          </p>
        </div>
      </section>

      {/* ── Getting Started ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            {page.gettingStarted.headline}
          </h2>
          <div className="mt-8 max-w-[65ch] space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            {page.gettingStarted.intro.map((line) => (
              <p key={line}>
                {line}
              </p>
            ))}
          </div>
          <div className="mt-10 grid items-stretch gap-6 md:grid-cols-2">
            {page.gettingStarted.cards.map((card) => (
              <article
                key={card.title}
                className="flex h-full flex-col border border-[var(--taupe-medium)]/50 bg-[var(--linen)]/40 px-7 py-10 md:px-8 md:py-12"
              >
                <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
                  {card.eyebrow}
                </p>
                <h3 className="mt-4 font-heading text-3xl text-[var(--forest-sage)]">
                  {card.title}
                </h3>
                <p className="mt-10 font-heading text-4xl text-[var(--forest-sage)] md:text-5xl">
                  {card.price}
                </p>
                {card.lead.length > 0 ? (
                  <div className="mt-6 space-y-2 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
                    {card.lead.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                ) : null}
                {card.checklist.length > 0 ? (
                  <ul className="mt-8 space-y-4">
                    {card.checklist.map((item) => (
                      <li
                        key={item}
                        className="flex items-baseline gap-3 text-base text-[var(--forest-sage)]/85 md:text-lg"
                      >
                        <span
                          className="shrink-0 font-heading text-lg leading-none text-[var(--heritage-sage)]"
                          aria-hidden
                        >
                          ✓
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {card.body.length > 0 ? (
                  <div className="mt-10 max-w-[65ch] space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
                    {card.body.map((line) => (
                      <p key={line}>
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-auto space-y-2 pt-10 text-sm tracking-wide text-[var(--forest-sage)]/55">
                  {card.footer.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founding Venue Program ── */}
      <OurFirstFriends programOnly />

      {/* ── Concise philosophy — full belief lives on Why Hello to Cheers ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {page.philosophy.eyebrow}
          </p>
          <div className="mt-10 space-y-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            {page.philosophy.lines.map((line) => (
              <p
                key={line}
                className="font-heading text-2xl leading-[1.35] text-[var(--forest-sage)] md:text-3xl"
              >
                {line}
              </p>
            ))}
          </div>
          <p className="mt-12">
            <Link
              href="/why-wevenu#pricing-philosophy"
              className="font-heading text-xl text-[var(--forest-sage)] underline-offset-8 hover:underline md:text-2xl"
            >
              Read our full pricing philosophy →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Our First Friends — intentional exception; also on Why Hello to Cheers ── */}
      <OurFirstFriends letterOnly />
    </div>
  );
}

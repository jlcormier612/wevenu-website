import { PLACEHOLDER } from "@/lib/marketing/content";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { Section } from "@/components/marketing/section";

export function PricingTiers() {
  const { pricing } = PLACEHOLDER;

  return (
    <Section tone="white" headline={pricing.headline} intro={pricing.intro}>
      <div className="grid gap-8 md:grid-cols-2">
        {pricing.tiers.map((tier) => (
          <article
            key={tier.name}
            className="flex flex-col border border-[var(--taupe-light)] bg-[var(--natural-cream)]/60 px-8 py-10 md:px-10 md:py-12"
          >
            <h3 className="font-heading text-3xl font-medium text-[var(--forest-sage)]">
              {tier.name}
            </h3>
            <p className="mt-3 text-sm font-medium tracking-wide text-[var(--heritage-sage)]">
              {tier.audience}
            </p>
            <p className="mt-6 flex-1 text-base leading-relaxed text-[var(--forest-sage)]/75">
              {tier.description}
            </p>
            <p className="mt-8 text-sm text-[var(--forest-sage)]/55">
              Pricing shared during your walkthrough
            </p>
            <div className="mt-6">
              <MarketingCta className="w-full sm:w-auto" />
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

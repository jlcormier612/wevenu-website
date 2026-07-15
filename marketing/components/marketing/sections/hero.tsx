import { MARKETING_MEDIA, PLACEHOLDER } from "@/lib/marketing/content";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MediaFrame } from "@/components/marketing/media-frame";

export function MarketingHero() {
  const { hero } = PLACEHOLDER;

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-14 md:py-24 lg:py-28">
        <div className="marketing-fade-up">
          <p className="mb-5 font-heading text-2xl font-medium tracking-tight text-[var(--heritage-sage)] md:text-3xl">
            Wevenu
          </p>
          <h1 className="font-heading text-4xl font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-5xl lg:text-[3.4rem]">
            {hero.headline}
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            {hero.sentence}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <MarketingCta />
            <MarketingCta
              href="/product"
              label={hero.secondaryCta}
              variant="secondary"
            />
          </div>
        </div>

        <div className="marketing-fade-up-delay relative grid gap-4">
          <MediaFrame
            src={MARKETING_MEDIA.heroVenue}
            alt="Elegant venue setting with natural light"
            aspect="photo"
            priority
            className="md:ml-6"
          />
          <MediaFrame
            src={MARKETING_MEDIA.dashboard}
            alt="Wevenu product workspace"
            aspect="product"
            className="md:hidden"
          />
          <div className="absolute -bottom-6 left-0 right-8 hidden overflow-hidden rounded-2xl border border-[var(--taupe-light)] shadow-[0_20px_60px_-30px_rgba(79,95,79,0.45)] md:block md:right-auto md:w-[72%]">
            <MediaFrame
              src={MARKETING_MEDIA.dashboard}
              alt="Wevenu product workspace"
              aspect="product"
            />
          </div>
        </div>
      </div>
      <div className="h-16 md:h-24" aria-hidden />
    </section>
  );
}

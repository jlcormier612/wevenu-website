import { MARKETING_MEDIA, PLACEHOLDER } from "@/lib/marketing/content";

import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { MediaFrame } from "@/components/marketing/media-frame";

export function MarketingHero() {
  const { hero } = PLACEHOLDER;

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-14 md:py-24 lg:py-28">
        <div>
          <p className="mb-5 font-heading text-2xl font-medium tracking-tight text-[var(--heritage-sage)] md:text-3xl">
            Hello to Cheers
          </p>
          <h1 className="font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[3.36rem] lg:text-[3.4rem]">
            {hero.headline}
          </h1>
          <p className="mt-6 max-w-md text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg">
            {hero.sentence}
          </p>
          <WalkthroughCtas className="mt-9 gap-3">
            <MarketingCta
              href="/product"
              label={hero.secondaryCta}
              variant="ghost"
            />
          </WalkthroughCtas>
        </div>

        <div className="relative grid gap-4">
          <MediaFrame
            src={MARKETING_MEDIA.heroVenue}
            alt="Elegant venue setting with natural light"
            aspect="photo"
            priority
            className="md:ml-6"
          />
          <MediaFrame
            src={MARKETING_MEDIA.dashboard}
            alt="Hello to Cheers product workspace"
            aspect="product"
            className="md:hidden"
          />
          <div className="absolute -bottom-6 left-0 right-8 hidden md:block md:right-auto md:w-[72%]">
            <MediaFrame
              src={MARKETING_MEDIA.dashboard}
              alt="Hello to Cheers product workspace"
              aspect="product"
            />
          </div>
        </div>
      </div>
      <div className="h-16 md:h-24" aria-hidden />
    </section>
  );
}

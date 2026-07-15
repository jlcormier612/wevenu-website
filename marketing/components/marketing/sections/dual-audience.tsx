import { MARKETING_MEDIA, PLACEHOLDER } from "@/lib/marketing/content";

import { MediaFrame } from "@/components/marketing/media-frame";
import { Section } from "@/components/marketing/section";

export function DualAudienceSection() {
  const { dual } = PLACEHOLDER;

  return (
    <Section tone="white">
      <div className="grid gap-16 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className="font-heading text-3xl font-medium text-[var(--forest-sage)] md:text-4xl">
            {dual.couples.title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--forest-sage)]/70">
            {dual.couples.body}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <MediaFrame
              src={MARKETING_MEDIA.garden}
              alt="Garden ceremony placeholder"
              caption="Wedding website"
            />
            <MediaFrame
              src={MARKETING_MEDIA.tablescape}
              alt="Reception table setting placeholder"
              caption="Couple portal"
            />
          </div>
        </div>

        <div>
          <h2 className="font-heading text-3xl font-medium text-[var(--forest-sage)] md:text-4xl">
            {dual.venues.title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--forest-sage)]/70">
            {dual.venues.body}
          </p>
          <div className="mt-8 space-y-4">
            <MediaFrame
              src={MARKETING_MEDIA.dashboard}
              alt="Wevenu dashboard"
              aspect="product"
              caption="Dashboard · Calendar · Planning"
            />
            <MediaFrame
              src={MARKETING_MEDIA.architecture}
              alt="Venue architecture placeholder"
              aspect="wide"
              caption="Your venue, beautifully organized"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

import { FeaturesShowroom } from "@/components/marketing/features-showroom";
import { FeaturesShowroomHero } from "@/components/marketing/features-showroom-hero";
import { FeaturesSpotlights } from "@/components/marketing/features-spotlights";
import { SignatureClosingCta } from "@/components/marketing/signature-closing-cta";
import { FEATURES_PAGE } from "@/lib/marketing/features-page";

import "@/app/features-showroom.css";
import "@/app/features-spotlights.css";

type FeaturesAssembledProps = {
  collectionId?: string;
};

/**
 * Assembled Features page — editorial hero, Linen showroom, Concept A spotlights, closing CTA.
 * Used by local `/features`. Preview routes remain available for comparison.
 */
export function FeaturesAssembled({ collectionId }: FeaturesAssembledProps) {
  return (
    <div className="fs-page fs-page-linen">
      <FeaturesShowroomHero />
      <FeaturesShowroom concept="linen" initialCollectionId={collectionId} />
      <FeaturesSpotlights concept="a" />

      <SignatureClosingCta
        headingId="fs-features-close-heading"
        headline={FEATURES_PAGE.close.headline}
        body={FEATURES_PAGE.close.body}
        bodyVariant="lines"
        surface="botanical"
      />
    </div>
  );
}

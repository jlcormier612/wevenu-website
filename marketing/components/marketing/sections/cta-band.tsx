import { MarketingCta } from "@/components/marketing/marketing-cta";
import { Section } from "@/components/marketing/section";

type CtaBandProps = {
  headline?: string;
  body?: string;
};

export function CtaBand({
  headline = "Request a Walkthrough",
  body = "A calm conversation about your venue — no trial, no pressure.",
}: CtaBandProps) {
  return (
    <Section tone="cream" narrow headline={headline} intro={body}>
      <div className="flex justify-center">
        <MarketingCta />
      </div>
    </Section>
  );
}

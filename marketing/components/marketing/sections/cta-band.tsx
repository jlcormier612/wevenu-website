import { ClosingCta } from "@/components/marketing/closing-cta";
import { Section } from "@/components/marketing/section";

type CtaBandProps = {
  headline?: string;
  body?: string;
};

export function CtaBand({
  headline = "Schedule a Walkthrough",
  body = "A calm conversation about your venue — no trial, no pressure.",
}: CtaBandProps) {
  return (
    <Section tone="cream" narrow headline={headline} intro={body}>
      <ClosingCta />
    </Section>
  );
}

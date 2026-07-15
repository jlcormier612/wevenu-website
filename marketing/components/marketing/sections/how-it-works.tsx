import { PLACEHOLDER } from "@/lib/marketing/content";

import { Section } from "@/components/marketing/section";

export function HowItWorksSection() {
  const { howItWorks } = PLACEHOLDER;

  return (
    <Section tone="linen" headline={howItWorks.headline}>
      <ol className="space-y-0">
        {howItWorks.steps.map((step, index) => (
          <li
            key={step.title}
            className="grid gap-4 border-t border-[var(--taupe-light)] py-8 md:grid-cols-[4rem_1fr_1.2fr] md:items-baseline"
          >
            <span className="font-heading text-3xl text-[var(--heritage-sage)]/50">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="font-heading text-xl font-medium text-[var(--forest-sage)] md:text-2xl">
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-[var(--forest-sage)]/70 md:text-base">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

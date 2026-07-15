import { PLACEHOLDER } from "@/lib/marketing/content";

import { Section } from "@/components/marketing/section";

export function PillarsSection() {
  const { connected, pillars } = PLACEHOLDER;

  return (
    <Section
      tone="cream"
      headline={connected.headline}
      intro={connected.intro}
    >
      <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((pillar, index) => (
          <div key={pillar.title} className="border-t border-[var(--taupe-light)] pt-6">
            <p className="mb-3 text-xs tracking-[0.2em] text-[var(--heritage-sage)]">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="font-heading text-2xl font-medium text-[var(--forest-sage)]">
              {pillar.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--forest-sage)]/70">
              {pillar.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

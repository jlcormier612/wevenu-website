import { PLACEHOLDER } from "@/lib/marketing/content";

import { Section } from "@/components/marketing/section";

export function TrustedBySection() {
  const { trusted } = PLACEHOLDER;

  return (
    <Section tone="white" narrow eyebrow={trusted.eyebrow}>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-45">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-28 rounded-full bg-[var(--taupe-medium)]/50"
            aria-hidden
          />
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-[var(--forest-sage)]/55">
        {trusted.body}
      </p>
    </Section>
  );
}

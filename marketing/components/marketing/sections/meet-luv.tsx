import { PLACEHOLDER } from "@/lib/marketing/content";

import { Section } from "@/components/marketing/section";

export function MeetLuvSection() {
  const { luv } = PLACEHOLDER;

  return (
    <Section tone="sage" narrow headline={luv.headline} intro={luv.body}>
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--true-white)]/15">
          <span
            className="block h-3 w-3 rounded-full bg-[var(--soft-sage)] ring-[6px] ring-[var(--true-white)]/25"
            aria-hidden
          />
        </div>
        <p className="text-sm tracking-wide text-[var(--true-white)]/65">
          Included with every Wevenu plan
        </p>
      </div>
    </Section>
  );
}

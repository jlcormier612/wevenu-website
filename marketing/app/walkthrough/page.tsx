import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/lead-form";
import { Section } from "@/components/marketing/section";
import { PLACEHOLDER } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Request a Walkthrough",
};

export default function WalkthroughPage() {
  const { walkthrough } = PLACEHOLDER;

  return (
    <Section
      tone="cream"
      narrow
      headline={walkthrough.headline}
      intro={walkthrough.body}
    >
      <div className="mx-auto max-w-lg rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 md:px-8 md:py-10">
        <LeadForm intent="walkthrough" />
      </div>
    </Section>
  );
}

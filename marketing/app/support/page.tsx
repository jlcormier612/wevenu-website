import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/lead-form";
import { Section } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Support",
};

export default function SupportPage() {
  return (
    <Section
      tone="cream"
      narrow
      hero
      headline="How can we help?"
      intro="Already with Hello to Cheers, or need a hand before you join? Send a note and we’ll follow up on the same relationship timeline."
    >
      <div className="mx-auto max-w-lg rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 md:px-8 md:py-10">
        <LeadForm intent="support" />
      </div>
    </Section>
  );
}

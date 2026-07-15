import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/lead-form";
import { Section } from "@/components/marketing/section";
import { PLACEHOLDER } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  const { contact } = PLACEHOLDER;

  return (
    <Section tone="cream" narrow headline={contact.headline} intro={contact.body}>
      <div className="mx-auto max-w-lg rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 md:px-8 md:py-10">
        <LeadForm intent="contact" />
      </div>
    </Section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { CalendlyEmbed } from "@/components/marketing/calendly-embed";
import { LeadForm } from "@/components/marketing/lead-form";
import { Section } from "@/components/marketing/section";
import { PLACEHOLDER } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Schedule a Walkthrough",
};

export default function WalkthroughPage() {
  const { walkthrough } = PLACEHOLDER;
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim() || "";

  return (
    <Section
      tone="cream"
      narrow={!calendlyUrl}
      hero
      headline={walkthrough.headline}
      intro={walkthrough.body}
    >
      {calendlyUrl ? (
        <div className="mx-auto max-w-3xl space-y-8">
          <CalendlyEmbed url={calendlyUrl} />
          <p className="text-center text-sm text-[var(--forest-sage)]/70">
            Prefer email?{" "}
            <Link
              href="#prefer-email"
              className="font-medium text-[var(--heritage-sage)] underline-offset-4 hover:underline"
            >
              Contact us
            </Link>{" "}
            and we&apos;ll find a time together.
          </p>
          <div
            id="prefer-email"
            className="mx-auto max-w-lg rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 md:px-8 md:py-10"
          >
            <p className="mb-5 text-sm leading-relaxed text-[var(--forest-sage)]/75">
              Optional — leave a note if you&apos;d rather we reach out by email.
            </p>
            <LeadForm intent="walkthrough" />
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-6">
          <div className="rounded-[2rem] border border-dashed border-[var(--taupe-medium)] bg-[var(--true-white)]/80 px-6 py-5 text-center">
            <p className="text-sm font-medium text-[var(--forest-sage)]">
              Scheduling link coming soon
            </p>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/70">
              Leave your details below and we&apos;ll follow up to book a walkthrough.
            </p>
          </div>
          <div className="rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 md:px-8 md:py-10">
            <LeadForm intent="walkthrough" />
          </div>
          <p className="text-center text-sm text-[var(--forest-sage)]/70">
            Prefer email?{" "}
            <Link
              href="/contact"
              className="font-medium text-[var(--heritage-sage)] underline-offset-4 hover:underline"
            >
              Contact us
            </Link>
          </p>
        </div>
      )}
    </Section>
  );
}

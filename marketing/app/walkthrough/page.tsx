import type { Metadata } from "next";
import Link from "next/link";

import { CalendlyEmbed } from "@/components/marketing/calendly-embed";
import { LeadForm } from "@/components/marketing/lead-form";
import { Section } from "@/components/marketing/section";
import { PLACEHOLDER } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Schedule a Walkthrough",
};

type WalkthroughSearchParams = Promise<{ intent?: string }>;

export default async function WalkthroughPage({
  searchParams,
}: {
  searchParams: WalkthroughSearchParams;
}) {
  const params = await searchParams;
  const moreInfo = params.intent === "more-info";
  const { walkthrough } = PLACEHOLDER;
  // Embed when NEXT_PUBLIC_CALENDLY_URL is set in marketing/.env.local (restart required).
  // Email LeadForm below still creates walkthrough_requested without Calendly.
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim() || "";

  const formHeading = moreInfo
    ? "Request more information"
    : calendlyUrl
      ? "Prefer not to pick a time yet?"
      : "Leave your details";
  const formIntro = moreInfo
    ? "Tell us a little about your venue — we\u2019ll follow up with answers, no calendar booking required."
    : calendlyUrl
      ? "Optional — leave a note if you\u2019d rather we reach out by email before booking a time."
      : "Leave your details below and we\u2019ll follow up to book a walkthrough.";

  return (
    <Section
      tone="cream"
      narrow={!calendlyUrl}
      hero
      headline={moreInfo ? "Request more information" : walkthrough.headline}
      intro={
        moreInfo
          ? "A calm first hello about your venue — answers without booking a walkthrough time."
          : walkthrough.body
      }
    >
      {calendlyUrl ? (
        <div className="mx-auto max-w-4xl space-y-8">
          <CalendlyEmbed url={calendlyUrl} />
          <p className="text-center text-sm text-[var(--forest-sage)]/70">
            Prefer email?{" "}
            <Link
              href="#request-info"
              className="font-medium text-[var(--heritage-sage)] underline-offset-4 hover:underline"
            >
              Request more information
            </Link>{" "}
            without picking a time.
          </p>
          <div
            id="request-info"
            className="mx-auto max-w-lg scroll-mt-28 rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 md:px-8 md:py-10"
          >
            <p className="mb-2 font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
              {formHeading}
            </p>
            <p className="mb-5 text-sm leading-relaxed text-[var(--forest-sage)]/75">
              {formIntro}
            </p>
            <LeadForm intent="walkthrough" moreInfo={moreInfo} />
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
          <div
            id="request-info"
            className="scroll-mt-28 rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 md:px-8 md:py-10"
          >
            <p className="mb-2 font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
              {formHeading}
            </p>
            <p className="mb-5 text-sm leading-relaxed text-[var(--forest-sage)]/75">
              {formIntro}
            </p>
            <LeadForm intent="walkthrough" moreInfo={moreInfo} />
          </div>
        </div>
      )}
    </Section>
  );
}

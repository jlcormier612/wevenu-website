import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WalkthroughExperience } from "@/components/marketing/walkthrough-experience";
import { resolveCalendlyEmbedUrl } from "@/lib/marketing/calendly-url";
import { MORE_INFO_CTA } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "Schedule a Walkthrough",
  description:
    "A personal conversation about your venue — see how Hello to Cheers could come together for the way you work.",
};

type WalkthroughSearchParams = Promise<{ intent?: string }>;

export default async function WalkthroughPage({
  searchParams,
}: {
  searchParams: WalkthroughSearchParams;
}) {
  const params = await searchParams;

  // Legacy more-info form lived on this page; Contact is now the destination.
  if (params.intent === "more-info") {
    redirect(MORE_INFO_CTA.href);
  }

  // Embed when NEXT_PUBLIC_CALENDLY_URL is a real calendly.com URL.
  // LeadForm /api/inquiries remain available on Contact and Support.
  const calendlyUrl = resolveCalendlyEmbedUrl(
    process.env.NEXT_PUBLIC_CALENDLY_URL,
  );

  return <WalkthroughExperience calendlyUrl={calendlyUrl} />;
}

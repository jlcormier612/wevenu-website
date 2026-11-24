import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WalkthroughExperience } from "@/components/marketing/walkthrough-experience";
import { resolveCalendlyEmbedUrl } from "@/lib/marketing/calendly-url";
import { MORE_INFO_CTA } from "@/lib/marketing/nav";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Schedule a Walkthrough",
  description:
    "A personal conversation about your venue — see how Hello to Cheers could come together for the way you work.",
  path: "/walkthrough",
});

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

  // Calendly opens only after the shared HTC intake form saves to CRM.
  // Contact keeps the same fields for Request Information.
  const calendlyUrl = resolveCalendlyEmbedUrl(
    process.env.NEXT_PUBLIC_CALENDLY_URL,
  );

  return <WalkthroughExperience calendlyUrl={calendlyUrl} />;
}

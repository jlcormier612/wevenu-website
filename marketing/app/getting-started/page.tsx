import type { Metadata } from "next";

import { GettingStartedExperience } from "@/components/marketing/getting-started-experience";
import { GETTING_STARTED_PAGE } from "@/lib/marketing/getting-started-page";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: GETTING_STARTED_PAGE.meta.title,
  description: GETTING_STARTED_PAGE.meta.description,
  path: "/getting-started",
});

export default function GettingStartedPage() {
  return <GettingStartedExperience />;
}

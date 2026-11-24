import type { Metadata } from "next";

import { HomepageHybrid } from "@/components/marketing/homepage-hybrid";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  // Keep title/description only — do not set openGraph/twitter here or Next.js
  // replaces the root layout share image / large-card Twitter metadata.
  title: "Wedding & Event Venue Management Software",
  description:
    "Hello to Cheers — wedding and event venue management software with big capabilities and beautiful simplicity. Run your venue, plan exceptional events, and keep your team, clients, and vendors connected.",
  path: "/",
});

export default function MarketingHomePage() {
  return <HomepageHybrid />;
}

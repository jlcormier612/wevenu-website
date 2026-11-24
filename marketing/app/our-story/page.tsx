import type { Metadata } from "next";

import { OurStoryExperience } from "@/components/marketing/our-story-experience";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Our Story',
  description:
    'How Hello to Cheers began—listening to wedding and event venues, the friends who shaped the journey, and why Jennifer Cormier built something entirely new.',
  path: '/our-story',
});

export default function OurStoryPage() {
  return <OurStoryExperience />;
}

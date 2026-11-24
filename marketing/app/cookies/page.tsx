import type { Metadata } from "next";

import { CookiePreferencesExperience } from "@/components/marketing/cookie-preferences-experience";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Cookie Preferences',
  description:
    'Manage how Hello to Cheers uses cookies on this device.',
  path: '/cookies',
});

export default function CookiePreferencesPage() {
  return <CookiePreferencesExperience />;
}

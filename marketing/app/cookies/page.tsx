import type { Metadata } from "next";

import { CookiePreferencesExperience } from "@/components/marketing/cookie-preferences-experience";

export const metadata: Metadata = {
  title: "Cookie Preferences",
  description: "Manage how Wevenu uses cookies on this device.",
};

export default function CookiePreferencesPage() {
  return <CookiePreferencesExperience />;
}

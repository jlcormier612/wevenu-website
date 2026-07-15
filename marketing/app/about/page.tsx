import type { Metadata } from "next";

import { AboutExperience } from "@/components/marketing/about-experience";

export const metadata: Metadata = {
  title: "About Wevenu",
  description:
    "We didn't set out to build software. We set out to protect hospitality—for independent venues that believe the work is personal.",
};

export default function AboutPage() {
  return <AboutExperience />;
}

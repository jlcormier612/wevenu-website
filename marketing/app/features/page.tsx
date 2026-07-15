import type { Metadata } from "next";

import { FeaturesExperience } from "@/components/marketing/features-experience";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything your venue needs—sales, planning, operations, vendors, client and guest experience, financials, and Luv intelligence.",
};

export default function FeaturesPage() {
  return <FeaturesExperience />;
}

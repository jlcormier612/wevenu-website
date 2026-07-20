import type { Metadata } from "next";

import { FeaturesExperience } from "@/components/marketing/features-experience";

export const metadata: Metadata = {
  title: "Everything Included",
  description:
    "Everything your venue needs—sales, planning, operations, vendors, client and guest experience, financials, and Meet Luv.",
};

export default function FeaturesPage() {
  return <FeaturesExperience />;
}

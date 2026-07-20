import type { Metadata } from "next";

import { WhyWevenuExperience } from "@/components/marketing/why-wevenu-experience";

export const metadata: Metadata = {
  title: "Hospitality First",
  description:
    "Why Hello to Cheers exists—hospitality first, gratitude for our first friends, transparent pricing, and trust earned every month.",
};

export default function WhyWevenuPage() {
  return <WhyWevenuExperience />;
}

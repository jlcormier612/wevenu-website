import type { Metadata } from "next";

import { TrustExperience } from "@/components/marketing/trust-experience";

export const metadata: Metadata = {
  title: "Trust",
  description:
    "Trust isn't built by contracts. It's built by showing up—security, privacy, data ownership, reliability, and transparent terms from Wevenu.",
};

export default function TrustPage() {
  return <TrustExperience />;
}

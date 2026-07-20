import type { Metadata } from "next";

import { TrustExperience } from "@/components/marketing/trust-experience";

export const metadata: Metadata = {
  title: "Our Promise",
  description:
    "Trust isn't something you ask for. It's something you earn—security, privacy, data ownership, reliability, and transparent terms from Hello to Cheers.",
};

export default function TrustPage() {
  return <TrustExperience />;
}

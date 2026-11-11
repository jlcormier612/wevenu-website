import type { Metadata } from "next";

import { TrustExperience } from "@/components/marketing/trust-experience";

export const metadata: Metadata = {
  title: "Our Promise",
  description:
    "Trust is earned every day. Our promise: respect your relationships, protect your information, and give you control.",
};

export default function TrustPage() {
  return <TrustExperience />;
}

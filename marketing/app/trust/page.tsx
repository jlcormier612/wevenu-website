import type { Metadata } from "next";

import { TrustExperience } from "@/components/marketing/trust-experience";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Our Promise',
  description:
    'Trust is earned every day. Our promise: respect your relationships, protect your information, and give you control.',
  path: '/trust',
});

export default function TrustPage() {
  return <TrustExperience />;
}

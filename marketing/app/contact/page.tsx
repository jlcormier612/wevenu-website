import type { Metadata } from "next";

import { ContactExperience } from "@/components/marketing/contact-experience";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Contact',
  description:
    "Have a question about Hello to Cheers? Tell us about your venue — we're happy to help.",
  path: '/contact',
});

export default function ContactPage() {
  return <ContactExperience />;
}

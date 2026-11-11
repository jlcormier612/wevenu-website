import type { Metadata } from "next";

import { ContactExperience } from "@/components/marketing/contact-experience";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Have a question about Hello to Cheers? Tell us about your venue — we're happy to help.",
};

export default function ContactPage() {
  return <ContactExperience />;
}

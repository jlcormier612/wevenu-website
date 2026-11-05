import type { Metadata } from "next";

import { GettingStartedExperience } from "@/components/marketing/getting-started-experience";
import { GETTING_STARTED_PAGE } from "@/lib/marketing/getting-started-page";

export const metadata: Metadata = {
  title: GETTING_STARTED_PAGE.meta.title,
  description: GETTING_STARTED_PAGE.meta.description,
};

export default function GettingStartedPage() {
  return <GettingStartedExperience />;
}

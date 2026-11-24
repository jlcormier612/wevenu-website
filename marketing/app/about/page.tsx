import type { Metadata } from "next";
import { redirect } from "next/navigation";

/** About is no longer a primary destination — belief lives on Our Story. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AboutPage() {
  redirect("/our-story");
}

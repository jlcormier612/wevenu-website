import type { Metadata } from "next";
import { redirect } from "next/navigation";

/** Gratitude letter now lives inside Our Story. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OurFirstFriendsPage() {
  redirect("/our-story#our-first-friends");
}

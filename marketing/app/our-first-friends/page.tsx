import { redirect } from "next/navigation";

/** Gratitude letter now lives inside Our Story. */
export default function OurFirstFriendsPage() {
  redirect("/our-story#our-first-friends");
}

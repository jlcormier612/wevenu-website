import { redirect } from "next/navigation";

/** Gratitude letter now lives inside Why Wevenu. */
export default function OurFirstFriendsPage() {
  redirect("/why-wevenu#our-first-friends");
}

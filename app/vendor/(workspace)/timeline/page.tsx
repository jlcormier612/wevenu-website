import { redirect } from "next/navigation";

/** Global Run of show retired — Timeline is per-event only. */
export default function VendorTimelinePage() {
  redirect("/vendor/events");
}

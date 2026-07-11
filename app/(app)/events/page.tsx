import { redirect } from "next/navigation";

/**
 * The standalone Events list is retired — Bookings (/clients) is now the
 * venue's master workspace list. Redirected, not deleted outright, so
 * nothing that still links here breaks.
 */
export default function EventsListPage() {
  redirect("/clients");
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorMessagesInbox } from "@/components/vendor-app/vendor-messages-inbox";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorConversationInbox } from "@/lib/conversations/service";

export const metadata: Metadata = { title: "Messages — Vendor Portal" };

/**
 * RC2, Milestone 3 — replaces the "Messages are organized by event; coming
 * in Sprint 107" placeholder with a real event-grouped Conversation inbox.
 * One Conversation per event assignment (Photography for Emma & James vs.
 * DJ for Sarah & Mike are different threads, never merged) — see
 * docs/rc2-messaging-conversations-implementation-plan.md, Milestone 3.
 */
export default async function VendorMessagesPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const { conversations } = await getVendorConversationInbox();
  return <VendorMessagesInbox conversations={conversations} />;
}

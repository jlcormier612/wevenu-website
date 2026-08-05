import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorConversationThread } from "@/components/vendor-app/vendor-conversation-thread";
import { getVendorUser } from "@/lib/vendor-auth/service";
import {
  getVendorConversation,
  recoverVendorConversationId,
} from "@/lib/conversations/service";

type Props = { params: Promise<{ conversationId: string }> };

export const metadata: Metadata = { title: "Messages — Vendor Portal" };

/**
 * Vendor thread deep link used by:
 * - Messages inbox rows
 * - Notification bell "Open message"
 * - Luv briefing unread-message observations
 *
 * Pattern: `/vendor/messages/{conversationId}`
 *
 * Stale IDs (assignment CASCADE deleted the old conversation) are recovered
 * to the live twin for the same event/kind, else fall back to the inbox —
 * never a hard 404 for an authenticated vendor.
 */
export default async function VendorConversationPage({ params }: Props) {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const { conversationId } = await params;
  const result = await getVendorConversation(conversationId);

  if (!result.ok) {
    const recoveredId = await recoverVendorConversationId(conversationId);
    if (recoveredId && recoveredId !== conversationId) {
      redirect(`/vendor/messages/${recoveredId}`);
    }
    redirect("/vendor/messages");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <VendorConversationThread
        conversationId={conversationId}
        initialMessages={result.conversation.messages}
        eventName={result.conversation.eventName}
        venueName={result.conversation.venueName}
        coupleName={result.conversation.coupleName}
        counterpartyLabel={result.conversation.counterpartyLabel}
      />
    </div>
  );
}

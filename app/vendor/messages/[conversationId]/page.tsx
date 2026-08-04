import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { VendorConversationThread } from "@/components/vendor-app/vendor-conversation-thread";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorConversation } from "@/lib/conversations/service";

type Props = { params: Promise<{ conversationId: string }> };

export const metadata: Metadata = { title: "Conversation — Vendor Portal" };

export default async function VendorConversationPage({ params }: Props) {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const { conversationId } = await params;
  const result = await getVendorConversation(conversationId);
  if (!result.ok) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <VendorConversationThread conversationId={conversationId} initialMessages={result.conversation.messages} />
    </div>
  );
}

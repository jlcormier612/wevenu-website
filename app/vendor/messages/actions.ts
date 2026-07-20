"use server";

import { revalidatePath } from "next/cache";

import {
  getVendorConversation,
  sendVendorConversationMessage,
} from "@/lib/conversations/service";
import type { SendMessageResult, VendorConversationResult } from "@/lib/conversations/types";

export async function getVendorConversationAction(conversationId: string): Promise<VendorConversationResult> {
  return getVendorConversation(conversationId);
}

export async function sendVendorConversationMessageAction(
  conversationId: string,
  body: string,
): Promise<SendMessageResult> {
  const result = await sendVendorConversationMessage(conversationId, body);
  if (result.ok) {
    revalidatePath("/vendor/messages");
    revalidatePath(`/vendor/messages/${conversationId}`);
  }
  return result;
}

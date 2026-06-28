"use server";

import { revalidatePath } from "next/cache";

import { sendMessage } from "@/lib/messaging/service";
import type { ComposeInput, MessageEntityType, SendResult } from "@/lib/messaging/types";

export async function sendMessageAction(
  entityType: MessageEntityType,
  entityId: string,
  input: ComposeInput,
): Promise<SendResult> {
  const result = await sendMessage(entityType, entityId, input);
  if (result.ok) {
    const paths: Record<MessageEntityType, string> = {
      lead:   `/leads/${entityId}`,
      client: `/clients/${entityId}`,
      event:  `/events/${entityId}`,
    };
    revalidatePath(paths[entityType]);
    revalidatePath("/messaging");
  }
  return result;
}

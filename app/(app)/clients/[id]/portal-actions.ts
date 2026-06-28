"use server";

import { revalidatePath } from "next/cache";

import { createPortalSession, revokePortalSession } from "@/lib/portal/service";
import type { PortalSession } from "@/lib/portal/types";

export async function createPortalSessionAction(
  clientId: string,
  label: string | null,
): Promise<PortalSession | null> {
  const session = await createPortalSession(clientId, label, "couple");
  if (session) revalidatePath(`/clients/${clientId}`);
  return session;
}

export async function revokePortalSessionAction(
  clientId: string,
  sessionId: string,
): Promise<void> {
  await revokePortalSession(sessionId);
  revalidatePath(`/clients/${clientId}`);
}

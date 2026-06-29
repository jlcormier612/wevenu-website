"use server";
import { revalidatePath } from "next/cache";
import { createVendorPortalSession, revokeVendorPortalSession } from "@/lib/vendor-portal/service";
export async function createVendorPortalSessionAction(vendorId: string, label: string): Promise<{ ok: boolean; token?: string }> {
  const token = await createVendorPortalSession(vendorId, label);
  if (token) revalidatePath(`/vendors/${vendorId}`);
  return token ? { ok: true, token } : { ok: false };
}
export async function revokeVendorPortalSessionAction(vendorId: string, sessionId: string): Promise<void> {
  await revokeVendorPortalSession(sessionId);
  revalidatePath(`/vendors/${vendorId}`);
}

"use server";

import { confirmTourByToken } from "@/lib/tours/service";

export async function confirmTourAction(token: string): Promise<{ ok: boolean; error?: string; alreadyConfirmed?: boolean }> {
  return confirmTourByToken(token);
}

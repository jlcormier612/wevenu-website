"use server";

import { revalidatePath } from "next/cache";

import { addFaqStarterAgain } from "@/lib/venue-guide/provision";
import type { FaqStarterMasterKey } from "@/lib/venue-guide/starters";

function revalidateGuide() {
  revalidatePath("/guide");
  revalidatePath("/library");
}

export async function addFaqStarterAgainAction(
  masterKey: FaqStarterMasterKey,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await addFaqStarterAgain(masterKey);
  if (result.ok) revalidateGuide();
  return result;
}

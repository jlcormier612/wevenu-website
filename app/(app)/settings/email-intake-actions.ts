"use server";

import { revalidatePath } from "next/cache";
import { connectEmailIntake } from "@/lib/lead-intake/email-status";

export async function connectEmailIntakeAction(): Promise<{ ok: boolean }> {
  const result = await connectEmailIntake();
  if (result.ok) revalidatePath("/settings");
  return result;
}

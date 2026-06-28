"use server";

import { revalidatePath } from "next/cache";
import { saveLuvSettings, type LuvSettings } from "@/lib/luv/settings";

export async function saveLuvSettingsAction(settings: LuvSettings): Promise<void> {
  await saveLuvSettings(settings);
  revalidatePath("/settings");
}

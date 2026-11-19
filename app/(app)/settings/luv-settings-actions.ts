"use server";

import { revalidatePath } from "next/cache";

import {
  LuvSettingsPersistError,
  LuvSettingsUnauthorizedError,
  saveLuvSettings,
  type LuvSettings,
} from "@/lib/luv/settings";

export type SaveLuvSettingsResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "persist_failed"; message: string };

export async function saveLuvSettingsAction(settings: LuvSettings): Promise<SaveLuvSettingsResult> {
  try {
    await saveLuvSettings(settings);
    revalidatePath("/settings/communications");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    if (err instanceof LuvSettingsUnauthorizedError) {
      return { ok: false, error: "unauthorized", message: err.message };
    }
    if (err instanceof LuvSettingsPersistError) {
      return { ok: false, error: "persist_failed", message: err.message };
    }
    return {
      ok: false,
      error: "persist_failed",
      message: err instanceof Error ? err.message : "Could not save Luv settings.",
    };
  }
}

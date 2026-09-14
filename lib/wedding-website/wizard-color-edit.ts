/**
 * Helpers for the Website Studio Color Story step: when a couple edits one
 * role away from a curated Color Story, all six roles must be materialised
 * into the custom palette so a single edit never leaves the other five empty
 * after colorStoryId is cleared.
 */

import type { SixRoleColors } from "@/lib/wedding-website/curated-color-stories";

export const COLOR_STORY_ROLE_KEYS = [
  "colorPrimary",
  "colorSecondary",
  "colorAccent",
  "colorNeutral",
  "colorBackground",
  "colorText",
] as const satisfies readonly (keyof SixRoleColors)[];

export type ColorStoryRoleKey = (typeof COLOR_STORY_ROLE_KEYS)[number];

/** Merge current custom values with a curated seed, then apply one role edit. */
export function applyColorRoleEdit(input: {
  current: Partial<Record<ColorStoryRoleKey, string>>;
  seeded: SixRoleColors | null | undefined;
  role: ColorStoryRoleKey;
  nextHex: string;
}): Record<ColorStoryRoleKey, string> {
  const out = {} as Record<ColorStoryRoleKey, string>;
  for (const key of COLOR_STORY_ROLE_KEYS) {
    const custom = input.current[key]?.trim() || "";
    const seed = input.seeded?.[key]?.trim() || "";
    out[key] = custom || seed || "";
  }
  out[input.role] = input.nextHex.trim();
  return out;
}

/** Resolve the six hex values to persist when leaving the Color Story step. */
export function resolveColorStorySaveRoles(input: {
  custom: Partial<Record<ColorStoryRoleKey, string>>;
  seeded: SixRoleColors | null | undefined;
}): Record<ColorStoryRoleKey, string> {
  const out = {} as Record<ColorStoryRoleKey, string>;
  for (const key of COLOR_STORY_ROLE_KEYS) {
    out[key] = input.custom[key]?.trim() || input.seeded?.[key]?.trim() || "";
  }
  return out;
}

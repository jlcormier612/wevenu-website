/**
 * Workspace lifecycle settings (JSON) — White Glove timeline, etc.
 * Path: workspace/.data/lifecycle-settings.json
 */

import { promises as fs } from "fs";
import path from "path";

import {
  DEFAULT_WHITE_GLOVE_TIMELINE_DAYS,
  type WhiteGloveTimelineSettings,
} from "@shared/relationships";

export type LifecycleSettings = {
  whiteGlove: WhiteGloveTimelineSettings;
  updatedAt?: string;
};

const DEFAULT: LifecycleSettings = {
  whiteGlove: {
    minBusinessDays: DEFAULT_WHITE_GLOVE_TIMELINE_DAYS.min,
    maxBusinessDays: DEFAULT_WHITE_GLOVE_TIMELINE_DAYS.max,
  },
};

function settingsPath(): string {
  return path.join(process.cwd(), ".data", "lifecycle-settings.json");
}

export async function loadLifecycleSettings(): Promise<LifecycleSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<LifecycleSettings>;
    return {
      whiteGlove: {
        minBusinessDays:
          parsed.whiteGlove?.minBusinessDays ??
          DEFAULT.whiteGlove.minBusinessDays,
        maxBusinessDays:
          parsed.whiteGlove?.maxBusinessDays ??
          DEFAULT.whiteGlove.maxBusinessDays,
      },
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveLifecycleSettings(patch: {
  whiteGlove?: Partial<WhiteGloveTimelineSettings>;
}): Promise<LifecycleSettings> {
  const current = await loadLifecycleSettings();
  const next: LifecycleSettings = {
    whiteGlove: {
      minBusinessDays:
        patch.whiteGlove?.minBusinessDays ?? current.whiteGlove.minBusinessDays,
      maxBusinessDays:
        patch.whiteGlove?.maxBusinessDays ?? current.whiteGlove.maxBusinessDays,
    },
    updatedAt: new Date().toISOString(),
  };
  // Clamp
  next.whiteGlove.minBusinessDays = Math.max(
    1,
    Math.min(30, Math.round(next.whiteGlove.minBusinessDays)),
  );
  next.whiteGlove.maxBusinessDays = Math.max(
    next.whiteGlove.minBusinessDays,
    Math.min(60, Math.round(next.whiteGlove.maxBusinessDays)),
  );

  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

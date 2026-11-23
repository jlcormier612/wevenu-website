/**
 * Per–team-member CRM alert dismissals.
 * Stores only notification id + actor id + timestamp (no event payload copy).
 * Dismissing does not delete the underlying relationship / timeline / support event.
 */

import { appendFile, mkdir } from "fs/promises";
import path from "path";

import { filePath, readJsonlSync } from "@/lib/program3/jsonl";
import { getWorkspaceDataDir } from "@/lib/program3/paths";

export type NotificationDismissal = {
  notificationId: string;
  actorId: string;
  dismissedAt: string;
};

const DISMISSALS_FILE = "notification-dismissals.jsonl";

function dismissalsPath(): string {
  return filePath(DISMISSALS_FILE);
}

export function getDismissedNotificationIdsSync(actorId?: string): Set<string> {
  const rows = readJsonlSync<NotificationDismissal>(dismissalsPath());
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row?.notificationId) continue;
    if (actorId && row.actorId !== actorId) continue;
    ids.add(row.notificationId);
  }
  return ids;
}

export async function dismissNotifications(input: {
  notificationIds: string[];
  actorId: string;
}): Promise<{ dismissed: number }> {
  const actorId = input.actorId.trim();
  if (!actorId) return { dismissed: 0 };

  const unique = [
    ...new Set(input.notificationIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (unique.length === 0) return { dismissed: 0 };

  const already = getDismissedNotificationIdsSync(actorId);
  const toAppend = unique.filter((id) => !already.has(id));
  if (toAppend.length === 0) return { dismissed: 0 };

  const dir = getWorkspaceDataDir();
  await mkdir(dir, { recursive: true });
  const now = new Date().toISOString();
  const lines = toAppend
    .map((notificationId) =>
      JSON.stringify({
        notificationId,
        actorId,
        dismissedAt: now,
      } satisfies NotificationDismissal),
    )
    .join("\n");
  await appendFile(path.join(dir, DISMISSALS_FILE), `${lines}\n`, "utf8");
  return { dismissed: toAppend.length };
}

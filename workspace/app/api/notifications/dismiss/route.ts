import { NextResponse } from "next/server";

import { getNotifications } from "@/lib/data/store";
import {
  dismissNotifications,
  getDismissedNotificationIdsSync,
} from "@/lib/notifications/dismissals";
import { requireWorkspaceStaff } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

/**
 * POST { ids?: string[] }
 * Dismiss CRM Alerts for the acting team member only.
 * Empty / omitted ids ⇒ dismiss all currently outstanding (unread + not yet dismissed) alerts.
 */
export async function POST(request: Request) {
  const auth = await requireWorkspaceStaff();
  if (!auth.ok) return auth.response;
  await ensureProgram4Data();

  const actorId = auth.actor.id;
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  let ids = Array.isArray(body.ids)
    ? body.ids.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (ids.length === 0) {
    const dismissed = getDismissedNotificationIdsSync(actorId);
    ids = getNotifications({ unreadOnly: true })
      .filter((n) => !dismissed.has(n.id))
      .map((n) => n.id);
  }

  const result = await dismissNotifications({
    notificationIds: ids,
    actorId,
  });

  return NextResponse.json({ ok: true, dismissed: result.dismissed });
}

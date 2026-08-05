/**
 * Drop / rewrite stale new_message notifications after assignment recreate.
 *
 * Conversations CASCADE-delete with event_vendor_assignments, but
 * vendor_notifications.assignment_id is ON DELETE SET NULL — so unread
 * "New message" rows can keep pointing at dead /vendor/messages/{id} links
 * while the vendor inbox only shows empty live twins (or nothing).
 */
import { createClient } from "@/integrations/supabase/server";
import type { VendorConversationSummary } from "@/lib/conversations/types";
import type { VendorNotification } from "./types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

const MESSAGE_LINK_RE =
  /\/vendor\/messages\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function conversationIdFromNotificationLink(
  link: string | null | undefined,
): string | null {
  if (!link) return null;
  const m = MESSAGE_LINK_RE.exec(link);
  return m?.[1] ?? null;
}

function wantsCoupleThread(n: VendorNotification): boolean {
  return /couple/i.test(n.title);
}

function conversationHasMessages(c: VendorConversationSummary): boolean {
  return Boolean(c.lastMessageAt || c.latestMessage);
}

function findLiveTwin(
  n: VendorNotification,
  conversations: VendorConversationSummary[],
): VendorConversationSummary | undefined {
  if (!n.eventId) return undefined;
  const wantCouple = wantsCoupleThread(n);
  return conversations.find(
    (c) =>
      c.eventId === n.eventId &&
      (wantCouple
        ? c.conversationKind === "couple_vendor"
        : c.conversationKind === "venue_vendor"),
  );
}

export type MessageNotificationReconcileResult = {
  notifications: VendorNotification[];
  unreadCount: number;
  dismissedIds: string[];
  rewrittenIds: string[];
};

/**
 * Keep a new_message alert only when its conversation (or recoverable twin)
 * is openable and has at least one message. Otherwise mark read and point
 * the link at the live twin or the Messages inbox.
 */
export async function reconcileVendorMessageNotifications(
  client: DbClient,
  notifications: VendorNotification[],
  conversations: VendorConversationSummary[],
  totalUnreadFromRpc: number,
): Promise<MessageNotificationReconcileResult> {
  const liveById = new Map(conversations.map((c) => [c.conversationId, c]));
  const now = new Date().toISOString();
  const dismissedIds: string[] = [];
  const rewrittenIds: string[] = [];
  const idToNewLink = new Map<string, string>();

  const next = notifications.map((n) => {
    if (n.type !== "new_message") return n;

    const linkedId = conversationIdFromNotificationLink(n.link);
    if (!linkedId) {
      if (!n.readAt) dismissedIds.push(n.id);
      idToNewLink.set(n.id, "/vendor/messages");
      return { ...n, link: "/vendor/messages", readAt: n.readAt ?? now };
    }

    const live = liveById.get(linkedId);
    if (live && conversationHasMessages(live)) {
      return n;
    }

    const twin = live ?? findLiveTwin(n, conversations);
    if (twin && conversationHasMessages(twin)) {
      const newLink = `/vendor/messages/${twin.conversationId}`;
      if (n.link !== newLink) {
        rewrittenIds.push(n.id);
        idToNewLink.set(n.id, newLink);
      }
      // Keep unread only when the twin still needs a reply.
      if (twin.contactUnread > 0) {
        return { ...n, link: newLink };
      }
      if (!n.readAt) dismissedIds.push(n.id);
      return { ...n, link: newLink, readAt: n.readAt ?? now };
    }

    const fallback = twin
      ? `/vendor/messages/${twin.conversationId}`
      : "/vendor/messages";
    if (!n.readAt) dismissedIds.push(n.id);
    if (n.link !== fallback) {
      rewrittenIds.push(n.id);
      idToNewLink.set(n.id, fallback);
    }
    return { ...n, link: fallback, readAt: n.readAt ?? now };
  });

  const byLink = new Map<string, string[]>();
  for (const [id, link] of idToNewLink) {
    const list = byLink.get(link) ?? [];
    list.push(id);
    byLink.set(link, list);
  }

  for (const [link, ids] of byLink) {
    const { error } = await client
      .from("vendor_notifications")
      .update({ link })
      .in("id", ids);
    if (error) {
      console.error(
        "[reconcileVendorMessageNotifications] link rewrite failed:",
        error.message,
      );
    }
  }

  if (dismissedIds.length > 0) {
    const { error } = await client
      .from("vendor_notifications")
      .update({ read_at: now })
      .in("id", dismissedIds);
    if (error) {
      console.error(
        "[reconcileVendorMessageNotifications] dismiss failed:",
        error.message,
      );
    }
  }

  const dismissedUnread = dismissedIds.length;
  const correctedUnread = Math.max(0, totalUnreadFromRpc - dismissedUnread);

  return {
    notifications: next,
    unreadCount: correctedUnread,
    dismissedIds,
    rewrittenIds,
  };
}

/**
 * Rewrite every new_message row still pointing at a dead conversation id.
 * When `markRead` is true (default), also clears the unread badge — use that
 * when the target twin has no messages left to open.
 */
export async function dismissOrphanMessageNotificationsForConversation(
  client: DbClient,
  deadConversationId: string,
  fallbackLink: string,
  options: { markRead?: boolean } = {},
): Promise<void> {
  const markRead = options.markRead !== false;

  const { data, error } = await client
    .from("vendor_notifications")
    .select("id, read_at")
    .eq("type", "new_message")
    .like("link", `%${deadConversationId}%`);

  if (error) {
    console.error(
      "[dismissOrphanMessageNotificationsForConversation]",
      error.message,
    );
    return;
  }

  const rows = (data ?? []) as { id: string; read_at: string | null }[];
  if (rows.length === 0) return;

  const ids = rows.map((r) => r.id);
  const patch: { link: string; read_at?: string } = { link: fallbackLink };
  if (markRead) patch.read_at = new Date().toISOString();

  const { error: updateError } = await client
    .from("vendor_notifications")
    .update(patch)
    .in("id", ids);

  if (updateError) {
    console.error(
      "[dismissOrphanMessageNotificationsForConversation] update failed:",
      updateError.message,
    );
  }
}

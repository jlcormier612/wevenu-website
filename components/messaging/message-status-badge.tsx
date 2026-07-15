/**
 * MessageStatusBadge — Communication Trust Experience, Phase 3 (revised
 * per feedback: unified plain-English status, same vocabulary for email
 * and SMS, no carrier/provider jargon anywhere in this view).
 *
 * The one place a message's lifecycle is translated into plain English for
 * the coordinator-facing bubble views (legacy Messages tab and the
 * Conversation thread). A venue owner shouldn't see "Sent" in one place
 * and "Delivered" in another for the same underlying fact, and shouldn't
 * see different words for email vs. text — they're the same seven-state
 * lifecycle (Sending → Sent to provider → Delivered → Opened/Clicked →
 * Replied, or Failed at any point). Opened/Clicked simply never occur for
 * SMS — Twilio has no equivalent signal — so they never appear for that
 * channel, not because the vocabulary differs.
 *
 * Emoji rather than color: this badge renders both outside a bubble
 * (legacy Messages tab) and inside a solid-color bubble (Conversation
 * thread) — a hardcoded text color reads fine on one background and
 * clashes on the other, but an emoji's own color is unaffected by either.
 *
 * Never renders for inbound messages or record-only channels (portal,
 * internal note, phone log, voicemail) — those never carry a status at
 * all, by design.
 */

import { MESSAGE_STATUS_META } from "@/lib/communication/status-labels";

export function MessageStatusBadge({
  status, failureReason, isOutbound,
}: {
  status: string | null | undefined;
  failureReason?: string | null;
  isOutbound: boolean;
}) {
  if (!isOutbound || !status) return null;
  const meta = MESSAGE_STATUS_META[status];
  if (!meta) return null;
  const title = status === "failed" && failureReason ? failureReason : undefined;
  return (
    <span className={`inline-flex items-center gap-1 ${status === "failed" ? "font-semibold" : ""}`} title={title}>
      <span aria-hidden>{meta.emoji}</span> {meta.label}
    </span>
  );
}

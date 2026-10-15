/**
 * Distinct lead-level cue for an inbound message that still needs a response.
 * Independent of venue_seen_at (New/unseen) and Inbox venue_unread.
 */
import Link from "next/link";

import type { LeadMessageAttention } from "@/lib/leads/message-attention";
import { leadShowsMessageAttention } from "@/lib/leads/message-attention";

export function LeadMessageAttentionIndicator({
  attention,
}: {
  attention: LeadMessageAttention | null | undefined;
}) {
  if (!leadShowsMessageAttention(attention)) return null;
  return (
    <Link
      href={attention!.href}
      data-testid="lead-message-attention-indicator"
      className="inline-flex items-center gap-1 shrink-0 rounded-sm text-destructive hover:underline"
      aria-label="New message needs a response"
      title="Open conversation — message needs a response"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-destructive"
        aria-hidden
      />
      <span className="text-[10px] font-semibold uppercase tracking-wide">
        Message
      </span>
    </Link>
  );
}

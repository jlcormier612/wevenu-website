"use client";

/**
 * RelationshipConversationTab — the Lead/Client Detail page's "Conversation"
 * tab, Program 2 Phase 2B. Renders the exact same ConversationThread the
 * main-nav inbox uses — a coordinator reading or replying to Emma & James
 * from her own record sees byte-identical behavior to reading it from the
 * inbox, never a second, slightly-different implementation.
 *
 * No header repeated here (showHeader=false) — the tab itself already says
 * "Conversation"; a coordinator doesn't need to be told twice what they're
 * looking at. Reducing that one redundant line is a small, deliberate
 * instance of the "reduce cognitive load" North Star, not an oversight.
 */
import { ConversationThread } from "@/components/conversations/conversation-thread";
import type { ConversationSummary } from "@/lib/conversations/types";

export function RelationshipConversationTab({
  conversationId,
  leadId = null,
  clientId = null,
  eventId = null,
  eventCount,
  initialBody,
  initialSubject,
}: {
  conversationId: string | null;
  /** Relationship ids for Documents links + delivery recovery (I8). */
  leadId?: string | null;
  clientId?: string | null;
  /**
   * Only when the relationship has exactly one event (eventCount === 1).
   * Callers must not pass an arbitrary/earliest event id.
   */
  eventId?: string | null;
  /** When known; if omitted and eventId is set, treated as 1. */
  eventCount?: number;
  /** RC2, Milestone 5 — the Luv→Messages "Use this draft" bridge (lead-detail.tsx). */
  initialBody?: string;
  initialSubject?: string;
}) {
  if (!conversationId) {
    // Shouldn't happen in practice — every Relationship gets a Conversation
    // provisioned automatically — but a plain, honest empty state beats a
    // blank tab or a crash if it ever does.
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No conversation yet.
      </div>
    );
  }

  const resolvedEventCount =
    eventCount ?? (eventId ? 1 : undefined);
  const unambiguousEventId =
    resolvedEventCount === 1 ? (eventId ?? null) : null;

  // Minimal summary so embedded threads share Inbox Documents/recovery wiring.
  const summary: ConversationSummary | undefined =
    leadId || clientId || unambiguousEventId
      ? {
          id: conversationId,
          relationshipId: "",
          displayName: null,
          lastMessageAt: null,
          venueUnread: 0,
          contactUnread: 0,
          latestMessage: null,
          assignedStaffId: null,
          assignedStaffName: null,
          leadId: leadId ?? null,
          clientId: clientId ?? null,
          eventCount: resolvedEventCount,
          eventId: unambiguousEventId,
        }
      : undefined;

  return (
    <div className="flex min-h-[min(70svh,44rem)] flex-col overflow-hidden rounded-sm border border-border bg-card">
      <ConversationThread
        conversationId={conversationId}
        showHeader={false}
        summary={summary}
        initialBody={initialBody}
        initialSubject={initialSubject}
      />
    </div>
  );
}

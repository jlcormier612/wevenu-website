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

export function RelationshipConversationTab({ conversationId }: { conversationId: string | null }) {
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
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: 520 }}>
      <ConversationThread conversationId={conversationId} showHeader={false} />
    </div>
  );
}

import type { ConversationKind } from "@/lib/conversations/types";

/** Venue-facing Text is only for the venue ↔ couple relationship conversation. */
export function isTextingConversationKind(
  kind: ConversationKind | null | undefined,
): boolean {
  return kind === "venue_couple";
}

export const TEXTING_KIND_BLOCKED_MESSAGE =
  "Texting is only available for conversations with a couple.";

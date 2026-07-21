/**
 * Messaging — the canonical Conversation inbox.
 *
 * RC2, Milestone 5: conversation_experience_enabled now defaults true for
 * every venue (no toggle UI was ever built, so there was never a real "off"
 * state to preserve) — this page no longer branches on it. The legacy
 * couple_threads-backed inbox this used to fall back to still exists at
 * app/(app)/messaging/legacy-inbox.tsx as a compatibility artifact (see
 * docs/rc2-messaging-conversations-final-report.md), just no longer wired
 * into any live route.
 */
import { Suspense } from "react";

import { getTeamMembers } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { ConversationInbox } from "@/app/(app)/messaging/conversation-inbox";

export default async function MessagingPage() {
  const venue = await getCurrentVenue();
  const teamMembers = venue ? await getTeamMembers(venue.id) : [];
  // ConversationInbox reads ?conversation= (RC2, Milestone 4 — deep-linking
  // in from Search and Request cross-links) via useSearchParams, which
  // requires a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <ConversationInbox teamMembers={teamMembers} />
    </Suspense>
  );
}

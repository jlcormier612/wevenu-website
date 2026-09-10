/**
 * Inbox — the canonical Conversation workspace for venues.
 *
 * RC2, Milestone 5: conversation_experience_enabled defaults true for every
 * venue. The pre-Conversations couple_threads inbox was removed in Debt Gate
 * Pass 1 (D04) after confirmation it was unreachable from live routes.
 */
import type { Metadata } from "next";
import { Suspense } from "react";

import { getTeamMembers, getCurrentStaffMember } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { ConversationInbox } from "@/app/(app)/messaging/conversation-inbox";

export const metadata: Metadata = { title: "Inbox" };

export default async function MessagingPage() {
  const venue = await getCurrentVenue();
  const [teamMembers, currentStaff] = venue
    ? await Promise.all([getTeamMembers(venue.id), getCurrentStaffMember(venue.id)])
    : [[], null];
  // ConversationInbox reads ?conversation= (RC2, Milestone 4 — deep-linking
  // in from Search and Request cross-links) via useSearchParams, which
  // requires a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <div className="flex min-h-0 flex-1 flex-col">
        <ConversationInbox
          teamMembers={teamMembers}
          currentStaffId={currentStaff?.id ?? null}
        />
      </div>
    </Suspense>
  );
}

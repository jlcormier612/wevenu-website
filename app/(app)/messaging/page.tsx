/**
 * Messaging — Program 2 Phase 2B gate.
 *
 * A server component so the rollout flag can be checked before rendering
 * anything — the coordinator never sees a flash of the wrong experience.
 * Everything else about this cutover is additive: the legacy inbox is
 * untouched, and flipping conversationExperienceEnabled back off is a real,
 * safe rollback (docs/conversation-experience-cutover.md's rollout stages).
 */
import { getCurrentVenue } from "@/lib/venue/service";
import { getTeamMembers } from "@/lib/team/service";
import { ConversationInbox } from "@/app/(app)/messaging/conversation-inbox";
import { LegacyMessagingInbox } from "@/app/(app)/messaging/legacy-inbox";

export default async function MessagingPage() {
  const venue = await getCurrentVenue();
  if (!venue?.conversationExperienceEnabled) return <LegacyMessagingInbox />;
  const teamMembers = await getTeamMembers(venue.id);
  return <ConversationInbox teamMembers={teamMembers} />;
}

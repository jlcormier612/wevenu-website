/**
 * Inbox — the canonical Conversation workspace for venues.
 */
import type { Metadata } from "next";
import { Suspense } from "react";

import { ConversationInbox } from "@/app/(app)/messaging/conversation-inbox";
import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";
import { getTeamMembers, getCurrentStaffMember } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Inbox" };

async function InboxBodyIsland() {
  const venue = await getCurrentVenue();
  const [teamMembers, currentStaff, inquirySettings] = venue
    ? await Promise.all([
        getTeamMembers(venue.id),
        getCurrentStaffMember(venue.id),
        getInquiryFormSettings(),
      ])
    : [[], null, null];

  return (
    <ConversationInbox
      teamMembers={teamMembers}
      currentStaffId={currentStaff?.id ?? null}
      acceptedInquiryEventTypes={inquirySettings?.acceptedEventTypes ?? null}
    />
  );
}

export default function MessagingPage() {
  return (
    <div className="flex min-w-0 w-full flex-col" data-testid="inbox-streaming-root">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent px-3 pt-3 sm:px-4 lg:px-6">
        <PageHeader
          title="Inbox"
          description="Conversations with couples and vendors across your venue."
        />
      </div>
      <Suspense fallback={<NavListBodyFallback label="Loading inbox" />}>
        <InboxBodyIsland />
      </Suspense>
    </div>
  );
}

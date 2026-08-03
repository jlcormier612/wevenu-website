import Link from "next/link";

import { LuvBriefingCard } from "@/components/luv/luv-briefing";
import {
  DataTable,
  PageHeader,
  Panel,
  RelationshipLink,
  StatTile,
} from "@/components/shared/ui";
import {
  getDashboardBuckets,
  getRelationship,
  getTeamMember,
} from "@/lib/data/store";
import { loadLuvBriefing } from "@/lib/luv/load";
import { getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import { formatDateTime, formatRelativeDay } from "@/lib/utils";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  await ensureProgram4Data();
  const actor = await getActingMember();
  const { briefing, drafts } = loadLuvBriefing(actor);
  const d = getDashboardBuckets();

  return (
    <div>
      <PageHeader
        eyebrow="Today"
        title="Today's Activity"
        description="Actionable work across inquiries, walkthroughs, founders, and support — not charts for charts' sake."
      />

      <div className="mb-8">
        <LuvBriefingCard briefing={briefing} drafts={drafts} compact />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="New Inquiries" value={d.newInquiries.length} href="/sales?stage=inquiry" />
        <StatTile
          label="Walkthrough Requests"
          value={d.newWalkthroughRequests.length}
          href="/walkthroughs"
        />
        <StatTile label="New Subscribers" value={d.newSubscribers.length} href="/customer-success" />
        <StatTile label="White Glove" value={d.whiteGlovePurchases.length} href="/onboarding" />
        <StatTile
          label="Welcome Back"
          value={d.welcomeBackRequests.length}
          href="/founding"
          hint="Pending verification"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Upcoming Walkthroughs"
          value={d.upcomingWalkthroughs.length}
          href="/walkthroughs"
        />
        <StatTile
          label="Onboarding Sessions"
          value={d.upcomingOnboardingSessions.length}
          href="/onboarding"
        />
        <StatTile
          label="Founder Spots Left"
          value={d.founderProgress.remainingSpots}
          href="/founding"
          hint={`${d.founderProgress.currentCount} of ${d.founderProgress.totalSpots}`}
        />
        <StatTile
          label="Support Requests"
          value={d.supportRequests.length}
          href="/communications"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Panel title="Needs attention" className="lg:col-span-3">
          <div className="space-y-6">
            <Bucket
              title="New inquiries"
              empty="No new inquiries today."
              items={d.newInquiries.map((r) => (
                <RelationshipLink
                  key={r.id}
                  id={r.id}
                  name={r.venue.name}
                  subtitle={`${r.owner.firstName} ${r.owner.lastName} · ${r.venue.city}`}
                />
              ))}
            />
            <Bucket
              title="Welcome Back — pending"
              empty="No pending verifications."
              items={d.welcomeBackRequests.map((r) => (
                <RelationshipLink
                  key={r.id}
                  id={r.id}
                  name={r.venue.name}
                  subtitle="Verify founding Welcome Back status"
                />
              ))}
            />
            <Bucket
              title="Open support"
              empty="No open support."
              items={d.supportRequests.map((r) => (
                <RelationshipLink
                  key={r.id}
                  id={r.id}
                  name={r.venue.name}
                  subtitle={r.nextMilestone ?? "Support open"}
                />
              ))}
            />
          </div>
        </Panel>

        <Panel title="Recent notifications" className="lg:col-span-2">
          <ul className="space-y-4">
            {d.unreadNotifications.map((n) => {
              const rel = getRelationship(n.relationshipId);
              return (
                <li key={n.id}>
                  <Link
                    href={`/relationships/${n.relationshipId}`}
                    className="block hover:opacity-80"
                  >
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-0.5 text-sm ws-muted">
                      {n.body}
                      {rel ? ` · ${formatRelativeDay(n.createdAt)}` : null}
                    </p>
                  </Link>
                </li>
              );
            })}
            {d.unreadNotifications.length === 0 ? (
              <li className="text-sm ws-muted">You're caught up.</li>
            ) : null}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming walkthroughs">
          <DataTable
            headers={["Venue", "When", "Owner"]}
            rows={d.upcomingWalkthroughs.map((w) => {
              const rel = getRelationship(w.relationshipId);
              const tm = getTeamMember(w.assignedTeamMemberId);
              return [
                rel ? (
                  <RelationshipLink key={w.id} id={rel.id} name={rel.venue.name} />
                ) : (
                  w.relationshipId
                ),
                formatDateTime(w.scheduledAt),
                tm?.name ?? "—",
              ];
            })}
          />
        </Panel>

        <Panel title="Recent relationship activity">
          <ul className="space-y-4">
            {d.recentActivity.map((e) => {
              const rel = getRelationship(e.relationshipId);
              return (
                <li key={e.id} className="text-sm">
                  <Link
                    href={`/relationships/${e.relationshipId}`}
                    className="font-medium hover:text-[var(--heritage-sage)]"
                  >
                    {rel?.venue.name ?? "Relationship"}
                  </Link>
                  <span className="ws-muted"> — {e.title}</span>
                  <span className="mt-0.5 block text-xs ws-muted">
                    {formatRelativeDay(e.occurredAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Bucket({
  title,
  items,
  empty,
}: {
  title: string;
  items: React.ReactNode[];
  empty: string;
}) {
  return (
    <div>
      <p className="ws-eyebrow mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm ws-muted">{empty}</p>
      ) : (
        <div className="space-y-2">{items}</div>
      )}
    </div>
  );
}

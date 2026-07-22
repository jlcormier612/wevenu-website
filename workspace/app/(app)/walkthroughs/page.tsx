import {
  DataTable,
  PageHeader,
  Panel,
  RelationshipLink,
  StatusPill,
} from "@/components/shared/ui";
import { LogWalkthroughForm } from "@/components/walkthroughs/log-walkthrough-form";
import { WalkthroughActions } from "@/components/walkthroughs/walkthrough-actions";
import {
  getRelationship,
  getRelationships,
  getTeamMember,
  getTeamMembers,
  getWalkthroughs,
} from "@/lib/data/store";
import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import { formatDateTime, WALKTHROUGH_STATUS_LABELS } from "@/lib/utils";

export const metadata = { title: "Walkthroughs" };

export default async function WalkthroughsPage() {
  await ensureProgram4Data();
  const canManage = await actorCan("manage_walkthroughs");

  const upcoming = getWalkthroughs({ status: "upcoming" });
  const past = getWalkthroughs({
    status: ["completed", "rescheduled", "cancelled"],
  });

  const relationshipOptions = getRelationships().map((r) => ({
    id: r.id,
    label: `${r.venue.name} · ${r.owner.email || "no email"}`,
    email: r.owner.email,
  }));
  const teamOptions = getTeamMembers().map((m) => ({ id: m.id, name: m.name }));

  return (
    <div>
      <PageHeader
        eyebrow="Walkthroughs"
        title="Walkthrough management"
        description="Upcoming product walkthroughs. Completing, rescheduling, or cancelling appends to the relationship timeline."
        action={
          canManage ? (
            <LogWalkthroughForm
              relationships={relationshipOptions}
              teamMembers={teamOptions}
            />
          ) : undefined
        }
      />

      <Panel title="Upcoming">
        <DataTable
          headers={["Venue", "Contact", "Date", "Assigned", "Status", "Notes", "Actions"]}
          rows={upcoming.map((w) => {
            const rel = getRelationship(w.relationshipId);
            const tm = getTeamMember(w.assignedTeamMemberId);
            return [
              rel ? (
                <RelationshipLink id={rel.id} name={rel.venue.name} />
              ) : (
                w.relationshipId
              ),
              rel ? `${rel.owner.firstName} ${rel.owner.lastName}` : "—",
              formatDateTime(w.scheduledAt),
              tm?.name ?? "—",
              <StatusPill key={`${w.id}-st`}>{WALKTHROUGH_STATUS_LABELS[w.status]}</StatusPill>,
              w.notes ?? "—",
              canManage ? (
                <WalkthroughActions
                  key={`${w.id}-act`}
                  walkthroughId={w.id}
                  initialStatus={w.status}
                  venueName={rel?.venue.name ?? "Walkthrough"}
                />
              ) : (
                <StatusPill key={`${w.id}-ro`}>
                  {WALKTHROUGH_STATUS_LABELS[w.status]}
                </StatusPill>
              ),
            ];
          })}
        />
      </Panel>

      <Panel title="Recent history" className="mt-6">
        <DataTable
          headers={["Venue", "Date", "Assigned", "Status", "Notes"]}
          rows={past.map((w) => {
            const rel = getRelationship(w.relationshipId);
            const tm = getTeamMember(w.assignedTeamMemberId);
            return [
              rel ? (
                <RelationshipLink id={rel.id} name={rel.venue.name} />
              ) : (
                w.relationshipId
              ),
              formatDateTime(w.scheduledAt),
              tm?.name ?? "—",
              <StatusPill
                key={`${w.id}-st`}
                tone={w.status === "completed" ? "good" : "muted"}
              >
                {WALKTHROUGH_STATUS_LABELS[w.status]}
              </StatusPill>,
              w.notes ?? "—",
            ];
          })}
        />
      </Panel>
    </div>
  );
}

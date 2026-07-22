import {
  DataTable,
  PageHeader,
  Panel,
  RelationshipLink,
  StatTile,
} from "@/components/shared/ui";
import { TaskCompleteButton } from "@/components/tasks/task-complete-button";
import {
  getTasks,
  getTeamMember,
  getWhiteGloveRelationships,
} from "@/lib/data/store";
import { ensureWhiteGloveChecklistsInWorkspace } from "@/lib/white-glove/ensure-checklist";
import { formatDate, formatDateTime, TASK_STATUS_LABELS } from "@/lib/utils";
import {
  isWhiteGloveChecklistTitle,
  WHITE_GLOVE_CHECKLIST_TITLES,
} from "@shared/relationships";

export const metadata = { title: "White Glove" };

export default async function OnboardingPage() {
  await ensureWhiteGloveChecklistsInWorkspace();
  const whiteGlove = getWhiteGloveRelationships();

  return (
    <div>
      <PageHeader
        eyebrow="White Glove"
        title="White Glove onboarding"
        description="Hands-on customers and their Implementation Checklist — every task lives on the Relationship."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="White Glove customers" value={whiteGlove.length} />
        <StatTile
          label="Kickoffs scheduled"
          value={whiteGlove.filter((r) => r.nextMilestone?.toLowerCase().includes("kickoff")).length}
        />
        <StatTile
          label="In progress"
          value={whiteGlove.filter((r) => r.status === "onboarding").length}
        />
      </div>

      <Panel title="Customers" className="mt-8">
        <DataTable
          headers={["Venue", "Assigned", "Kickoff", "Checklist", "Status"]}
          rows={whiteGlove.map((r) => {
            const tm = getTeamMember(r.assignedTeamMemberId);
            const checklist = getTasks({ relationshipId: r.id }).filter((t) =>
              isWhiteGloveChecklistTitle(t.title),
            );
            const done = checklist.filter((t) => t.status === "completed").length;
            const total = Math.max(checklist.length, WHITE_GLOVE_CHECKLIST_TITLES.length);
            return [
              <RelationshipLink key={r.id} id={r.id} name={r.venue.name} />,
              tm?.name ?? "—",
              r.nextMilestoneAt ? formatDateTime(r.nextMilestoneAt) : "—",
              `${done} / ${total} tasks`,
              r.currentStageLabel,
            ];
          })}
        />
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {whiteGlove.map((r) => {
          const checklist = getTasks({ relationshipId: r.id })
            .filter((t) => isWhiteGloveChecklistTitle(t.title))
            .sort((a, b) => {
              const ao = Number(a.meta?.sort_order ?? 99);
              const bo = Number(b.meta?.sort_order ?? 99);
              if (ao !== bo) return ao - bo;
              return a.title.localeCompare(b.title);
            });
          return (
            <Panel key={r.id} title={r.venue.name}>
              <p className="mb-4 text-sm ws-muted">
                Implementation owner:{" "}
                {getTeamMember(checklist[0]?.ownerId ?? "tm_eli")?.name ?? "Eli Torres"}
                {" · "}
                <RelationshipLink id={r.id} name="Open relationship" />
              </p>
              <div className="space-y-2">
                {checklist.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-3 rounded-sm bg-[var(--warm-gray)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="mt-1 text-xs ws-muted">
                        {TASK_STATUS_LABELS[t.status]}
                        {t.dueDate ? ` · due ${formatDate(t.dueDate, { year: undefined })}` : ""}
                      </p>
                    </div>
                    <TaskCompleteButton
                      taskId={t.id}
                      title={t.title}
                      initialStatus={t.status}
                    />
                  </div>
                ))}
                {checklist.length === 0 ? (
                  <p className="text-sm ws-muted">Checklist will appear after backfill.</p>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

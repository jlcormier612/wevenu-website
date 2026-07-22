import {
  DataTable,
  PageHeader,
  Panel,
  RelationshipLink,
  StatusPill,
} from "@/components/shared/ui";
import { TaskCompleteButton } from "@/components/tasks/task-complete-button";
import { getRelationship, getTasks, getTeamMember } from "@/lib/data/store";
import { ensureWhiteGloveChecklistsInWorkspace } from "@/lib/white-glove/ensure-checklist";
import {
  formatDate,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/utils";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  await ensureWhiteGloveChecklistsInWorkspace();
  const tasks = getTasks();

  return (
    <div>
      <PageHeader
        eyebrow="Tasks"
        title="Work that belongs to a relationship"
        description="Every task is scoped to a venue relationship. Completing one records timeline activity."
      />

      <Panel>
        <DataTable
          headers={[
            "Title",
            "Relationship",
            "Owner",
            "Due",
            "Priority",
            "Status",
            "",
          ]}
          rows={tasks.map((t) => {
            const rel = getRelationship(t.relationshipId);
            const owner = getTeamMember(t.ownerId);
            const priorityTone =
              t.priority === "high" ? "warn" : t.priority === "medium" ? "neutral" : "muted";
            return [
              <div key={`${t.id}-title`}>
                <p className="font-medium">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-xs ws-muted">{t.description}</p>
                ) : null}
              </div>,
              rel ? (
                <RelationshipLink id={rel.id} name={rel.venue.name} />
              ) : (
                t.relationshipId
              ),
              owner?.name ?? "—",
              formatDate(t.dueDate, { year: undefined }),
              <StatusPill key={`${t.id}-pri`} tone={priorityTone}>
                {TASK_PRIORITY_LABELS[t.priority]}
              </StatusPill>,
              TASK_STATUS_LABELS[t.status],
              <TaskCompleteButton
                key={`${t.id}-btn`}
                taskId={t.id}
                title={t.title}
                initialStatus={t.status}
              />,
            ];
          })}
        />
      </Panel>
    </div>
  );
}

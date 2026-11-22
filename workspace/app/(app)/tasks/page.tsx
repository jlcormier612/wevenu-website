import Link from "next/link";

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
import type { Task } from "@/lib/types";

export const metadata = { title: "Tasks" };

type TaskFilter = "open" | "overdue" | "completed" | "all";

const FILTERS: { label: string; value: TaskFilter }[] = [
  { label: "Open", value: "open" },
  { label: "Overdue", value: "overdue" },
  { label: "Completed", value: "completed" },
  { label: "All", value: "all" },
];

function isTaskFilter(value: string | undefined): value is TaskFilter {
  return (
    value === "open" ||
    value === "overdue" ||
    value === "completed" ||
    value === "all"
  );
}

function isOpenStatus(status: Task["status"]) {
  return status === "open" || status === "in_progress";
}

function isOverdue(task: Task, now: number) {
  if (!isOpenStatus(task.status) || !task.dueDate) return false;
  return new Date(task.dueDate).getTime() < now;
}

function filterTasks(tasks: Task[], filter: TaskFilter, now: number) {
  switch (filter) {
    case "open":
      return tasks.filter((t) => isOpenStatus(t.status));
    case "overdue":
      return tasks.filter((t) => isOverdue(t, now));
    case "completed":
      return tasks.filter((t) => t.status === "completed");
    case "all":
      return tasks;
  }
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await ensureWhiteGloveChecklistsInWorkspace();
  const params = await searchParams;
  const filter = isTaskFilter(params.filter) ? params.filter : "open";
  const now = Date.now();
  const allTasks = getTasks();
  const tasks = filterTasks(allTasks, filter, now);

  return (
    <div>
      <PageHeader
        eyebrow="Tasks"
        title="Work that moves relationships"
        description="Follow-ups and next actions across your customer relationships."
      />

      <Panel>
        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "open" ? "/tasks" : `/tasks?filter=${f.value}`}
              className={filter === f.value ? "ws-chip-active" : "ws-chip"}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {tasks.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-medium text-[var(--htc-text)]">
              {filter === "open"
                ? "No open tasks"
                : filter === "overdue"
                  ? "No overdue tasks"
                  : filter === "completed"
                    ? "No completed tasks"
                    : "No tasks"}
            </p>
            <p className="mt-2 text-sm ws-muted">
              Follow-ups will appear here as relationships move forward.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
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
                    t.priority === "high"
                      ? "warn"
                      : t.priority === "medium"
                        ? "neutral"
                        : "muted";
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
            </div>

            <div className="space-y-3 md:hidden">
              {tasks.map((t) => {
                const rel = getRelationship(t.relationshipId);
                const owner = getTeamMember(t.ownerId);
                const priorityTone =
                  t.priority === "high"
                    ? "warn"
                    : t.priority === "medium"
                      ? "neutral"
                      : "muted";
                return (
                  <article key={t.id} className="ws-pipeline-card">
                    <p className="font-medium text-[var(--htc-text)]">{t.title}</p>
                    {t.description ? (
                      <p className="mt-1 text-xs ws-muted">{t.description}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusPill tone={priorityTone}>
                        {TASK_PRIORITY_LABELS[t.priority]}
                      </StatusPill>
                      <span className="text-xs ws-muted">
                        {TASK_STATUS_LABELS[t.status]}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="ws-muted">Relationship</dt>
                        <dd>
                          {rel ? (
                            <RelationshipLink id={rel.id} name={rel.venue.name} />
                          ) : (
                            t.relationshipId
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="ws-muted">Owner</dt>
                        <dd>{owner?.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="ws-muted">Due</dt>
                        <dd>{formatDate(t.dueDate, { year: undefined })}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <TaskCompleteButton
                        taskId={t.id}
                        title={t.title}
                        initialStatus={t.status}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

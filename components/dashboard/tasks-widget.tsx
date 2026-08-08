import Link from "next/link";
import { CheckSquare } from "lucide-react";

import { AttentionList } from "@/components/dashboard-system/attention-list";
import { formatDate, isOverdue, isDueToday } from "@/lib/leads/constants";
import type { TaskItem } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

// Dashboard Component System, Phase 1 Step 2 — shell migrated to
// AttentionList (bordered row variant); row content and copy unchanged.
export function TasksWidget({
  tasks,
  openTaskCount,
}: {
  tasks: TaskItem[];
  openTaskCount: number;
}) {
  return (
    <AttentionList
      icon={<CheckSquare className="h-4 w-4 text-muted-foreground" />}
      title="My Tasks"
      description="Open tasks across all leads."
      headerRight={
        openTaskCount > tasks.length && (
          <span className="text-xs text-muted-foreground">
            +{openTaskCount - tasks.length} more
          </span>
        )
      }
      items={tasks}
      getKey={(task) => task.id}
      rowVariant="bordered"
      emptyState={
        <p className="py-4 text-center text-sm text-muted-foreground">
          No open tasks. Add tasks to leads to see them here.
        </p>
      }
      renderRow={(task) => {
        const overdue = isOverdue(task.dueDate);
        const today = isDueToday(task.dueDate);
        return (
          <Link
            href={`/leads/${task.leadId}`}
            className="flex items-start gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors"
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground">{task.leadName}</p>
            </div>
            {task.dueDate && (
              <span
                className={cn(
                  "shrink-0 text-xs",
                  overdue
                    ? "font-medium text-destructive"
                    : today
                      ? "font-medium text-warning-foreground"
                      : "text-muted-foreground",
                )}
              >
                {overdue ? "Overdue" : today ? "Today" : formatDate(task.dueDate)}
              </span>
            )}
          </Link>
        );
      }}
    />
  );
}

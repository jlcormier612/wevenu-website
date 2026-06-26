import Link from "next/link";
import { CheckSquare } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, isOverdue, isDueToday } from "@/lib/leads/constants";
import type { TaskItem } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

export function TasksWidget({
  tasks,
  openTaskCount,
}: {
  tasks: TaskItem[];
  openTaskCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            My Tasks
          </CardTitle>
          {openTaskCount > tasks.length && (
            <span className="text-xs text-muted-foreground">
              +{openTaskCount - tasks.length} more
            </span>
          )}
        </div>
        <CardDescription>Open tasks across all leads.</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No open tasks. Add tasks to leads to see them here.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const overdue = isOverdue(task.dueDate);
              const today = isDueToday(task.dueDate);
              return (
                <Link
                  key={task.id}
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
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

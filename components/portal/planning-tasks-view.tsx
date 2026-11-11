"use client";

/**
 * Couple-facing venue planning tasks presentation (read-only).
 * Mirrors UnifiedTasksSection “From your venue” band without completion mutations.
 */

import { CheckCircle2, Circle, Clock } from "lucide-react";

import { formatEventRelativeDue, formatAbsoluteDueDate } from "@/lib/playbooks/due-dates";

export type PlanningTaskPreviewItem = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "blocked" | "complete" | "overdue" | string;
  dueDate: string | null;
  daysOffset: number | null;
  dueDateLocked: boolean;
  milestoneName: string | null;
  isRequired: boolean;
};

function dueLabel(t: PlanningTaskPreviewItem): string {
  if (t.daysOffset != null || t.dueDate) {
    return formatEventRelativeDue({
      daysOffset: t.daysOffset ?? 0,
      dueDate: t.dueDate ?? "",
      dueDateLocked: t.dueDateLocked,
      style: "urgency",
    });
  }
  if (t.dueDate) return `Due ${formatAbsoluteDueDate(t.dueDate)}`;
  return "";
}

export function PlanningTasksPortalView({
  tasks,
  venueName,
  released,
  staffPreviewLabel,
}: {
  tasks: PlanningTaskPreviewItem[];
  venueName: string;
  released: boolean;
  staffPreviewLabel?: string | null;
}) {
  if (!released && tasks.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center" data-testid="planning-portal-empty">
        <p className="text-sm font-medium text-heading">Planning not shared yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          When {venueName} releases your planning checklist, it will appear here.
        </p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center" data-testid="planning-portal-empty">
        <p className="text-sm font-medium text-heading">No planning items yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your venue hasn&apos;t added couple-facing planning tasks for this event.
        </p>
      </div>
    );
  }

  const open = tasks.filter((t) => t.status !== "complete");
  const done = tasks.filter((t) => t.status === "complete");

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6" data-testid="planning-portal-view">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-heading">From your venue</h2>
        <p className="text-sm text-muted-foreground">
          Planning items {venueName} shared for your event.
        </p>
        {staffPreviewLabel ? (
          <p className="text-xs text-muted-foreground">{staffPreviewLabel}</p>
        ) : null}
      </div>

      {open.length > 0 && (
        <ul className="rounded-xl border border-border bg-card divide-y divide-border">
          {open.map((t) => {
            const due = dueLabel(t);
            return (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-heading">{t.title}</p>
                  {t.description ? (
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{t.description}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {t.milestoneName ? <span>{t.milestoneName}</span> : null}
                    {due ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {due}
                      </span>
                    ) : null}
                    {t.isRequired ? <span className="font-medium">Required</span> : null}
                    {t.status === "overdue" ? <span className="text-destructive font-medium">Overdue</span> : null}
                    {t.status === "blocked" ? <span>Blocked</span> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
          <ul className="rounded-xl border border-border bg-card divide-y divide-border opacity-80">
            {done.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-sm text-muted-foreground line-through">{t.title}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

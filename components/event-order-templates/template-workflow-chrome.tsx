"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

const STEPS = [
  { id: "edit", label: "Edit" },
  { id: "preview", label: "Preview" },
  { id: "use", label: "Use / Send" },
] as const;

export type TemplateWorkflowStep = (typeof STEPS)[number]["id"];

/** Persistent Edit → Preview → Use/Send chrome with named back links. */
export function TemplateWorkflowChrome({
  templateId,
  current,
  className,
}: {
  templateId: string;
  current: TemplateWorkflowStep;
  className?: string;
}) {
  const editHref = `/library/event-order-templates/${templateId}`;
  const previewHref = `/library/event-order-templates/${templateId}/preview`;
  const listHref = "/library/event-order-templates";

  return (
    <nav
      aria-label="Template workflow"
      data-testid="eo-template-workflow-chrome"
      className={cn(
        "mb-1 flex flex-wrap items-center gap-2 text-xs",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {STEPS.map((step, i) => {
          const active = step.id === current;
          const href =
            step.id === "edit" ? editHref
              : step.id === "preview" ? previewHref
                : listHref;
          return (
            <li key={step.id} className="flex items-center gap-1.5">
              {i > 0 ? <span className="text-muted-foreground" aria-hidden>→</span> : null}
              <Link
                href={href}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-colors",
                  active
                    ? "htc-badge-active"
                    : "border border-border bg-card text-primary hover:bg-[var(--htc-hover-lift)]",
                )}
                data-testid={`eo-template-workflow-${step.id}`}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
      {current === "preview" ? (
        <Link
          href={editHref}
          className="ml-auto font-medium text-[var(--venue-primary)] hover:underline"
          data-testid="eo-template-workflow-back-edit"
        >
          ← Back to edit
        </Link>
      ) : null}
    </nav>
  );
}

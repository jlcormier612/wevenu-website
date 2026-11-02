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
        "sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur",
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
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                data-testid={`eo-template-workflow-${step.id}`}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="ml-auto flex flex-wrap gap-2 text-xs">
        {current === "preview" ? (
          <Link href={editHref} className="font-medium text-[var(--venue-primary)] hover:underline" data-testid="eo-template-workflow-back-edit">
            ← Back to edit
          </Link>
        ) : null}
        {current === "edit" ? (
          <Link href={previewHref} className="font-medium text-[var(--venue-primary)] hover:underline" data-testid="eo-template-workflow-to-preview">
            Preview →
          </Link>
        ) : null}
        <Link href={listHref} className="text-muted-foreground hover:text-foreground hover:underline">
          Templates
        </Link>
      </div>
    </nav>
  );
}

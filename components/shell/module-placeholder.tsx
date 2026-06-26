import * as React from "react";

import { Construction } from "lucide-react";

/**
 * Standard page header used across workspace pages. Answers "Where am I?" with a
 * clear title and optional supporting description, in line with the Wevenu UX
 * philosophy (calm, oriented screens).
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-medium tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Empty placeholder body for future modules. Sprint 1 ships navigation and
 * shells only — no business functionality. This communicates intent without
 * implementing any workflow.
 */
export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Construction className="h-7 w-7" />
        </span>
        <div className="space-y-1.5">
          <p className="font-heading text-lg font-medium text-foreground">
            {title} is coming soon
          </p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            This module is part of a future sprint. The workspace foundation,
            navigation and design system are in place; functionality will be
            added once this module is scheduled for development.
          </p>
        </div>
      </div>
    </div>
  );
}

import * as React from "react";

/**
 * Documents-tab recipe for Lead / Client / Booking workspace tabs.
 * White title card + botanical accent strip; calm-blue empties; content on beige canvas.
 */
export function RelationshipTabShell({
  title,
  description,
  actions,
  children,
  empty,
  testId,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** When set, renders calm-blue empty instead of children. */
  empty?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="space-y-6" data-testid={testId} data-htc-phase12="relationship-tab">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-medium text-heading">{title}</h1>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {empty ? (
        <div className="htc-surface-guidance flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
          {empty}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

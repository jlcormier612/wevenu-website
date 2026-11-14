"use client";

/**
 * Grouped commercial-completeness copy for send and preview surfaces.
 * Uses existing groupedCompletenessGuidance + section editor links.
 * Does not create a new setup system or invent prices.
 */
import Link from "next/link";

import {
  COMPLETENESS_INTRO,
  groupedCompletenessGuidance,
} from "@/lib/event-order-templates/commercial-state";
import { sectionEditorHref } from "@/lib/event-order-templates/editor-presentation";
import { sectionCompletenessIssues } from "@/lib/event-order-templates/section-workspace";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

export const COMPLETENESS_CONFIGURE_OR_REMOVE =
  "Set a price or mark them Included before sharing with clients, or remove offerings you do not want to offer. Open a section to edit.";

export function EventOrderCompletenessGuidance({
  template,
  testId,
}: {
  template: Pick<EventOrderTemplateWithDetails, "id" | "sections" | "groups" | "options">;
  testId: string;
}) {
  const issues = sectionCompletenessIssues(template.groups, template.options);
  if (issues.length === 0) return null;
  const guidance = groupedCompletenessGuidance(
    template.sections,
    template.groups,
    template.options,
  );

  return (
    <div
      className="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-sm"
      data-testid={testId}
      role="status"
    >
      <p className="font-medium text-heading">{COMPLETENESS_INTRO}</p>
      <p className="mt-1 text-muted-foreground">{COMPLETENESS_CONFIGURE_OR_REMOVE}</p>
      <div className="mt-2 space-y-2">
        {guidance.map((section) => (
          <div key={section.sectionId ?? section.sectionName}>
            {section.sectionId ? (
              <Link
                href={sectionEditorHref(template.id, section.sectionId)}
                className="text-xs font-semibold uppercase tracking-[0.12em] text-heading underline-offset-2 hover:underline"
                data-testid={`eo-completeness-section-${section.sectionId}`}
              >
                {section.sectionName}
              </Link>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-heading">
                {section.sectionName}
              </p>
            )}
            <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
              {section.lines.map((line) => (
                <li key={`${line.groupId}:${line.text}`}>{line.text}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

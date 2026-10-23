import type { TimelineTemplate } from "@/lib/timeline-templates/types";

/**
 * Preselect the venue's marked default for this event type + space.
 * Degrades to less-specific defaults; never invents a template the venue
 * has not marked. Space assignment on a template is metadata for this
 * preselection — it does not copy space onto timeline entries at apply.
 */
export function resolveDefaultTimelineTemplateId(
  templates: TimelineTemplate[],
  eventType: string | null,
  spaceId: string | null,
): string | undefined {
  const defaults = templates.filter((t) => t.isDefault);
  return (
    defaults.find((t) => t.eventType === eventType && t.spaceId === spaceId)
    ?? defaults.find((t) => t.eventType === eventType && !t.spaceId)
    ?? defaults.find((t) => !t.eventType && t.spaceId === spaceId)
    ?? defaults.find((t) => !t.eventType && !t.spaceId)
  )?.id;
}

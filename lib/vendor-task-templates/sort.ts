import type { VendorTaskTemplate } from "@/lib/vendor-task-templates/types";

/**
 * Sort packs for apply UI: event-type matches → untagged → other event types.
 * Within a bucket, keep sort_order / name.
 */
export function sortTemplatesForEventApply(
  templates: VendorTaskTemplate[],
  eventType: string | null,
): VendorTaskTemplate[] {
  const et = eventType?.trim() || null;
  const rank = (t: VendorTaskTemplate): number => {
    if (et && t.eventType === et) return 0;
    if (!t.eventType) return 1;
    return 2;
  };
  return [...templates].sort((a, b) => {
    const dr = rank(a) - rank(b);
    if (dr !== 0) return dr;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

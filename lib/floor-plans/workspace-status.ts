/**
 * Floor Plans tab presentation helpers. Read-only — no lifecycle decisions.
 */
import type { EventFloorPlanOfferWithTemplate } from "@/lib/floor-plan-offers/types";
import type { FloorPlan } from "@/lib/floor-plans/types";

/** The preference card appears only when the venue has something to decide. */
export function preferenceReviewIsActionable(input: {
  status: string | null;
  hasPreferred: boolean;
  multipleSeated: boolean;
  hasError: boolean;
}): boolean {
  return input.hasError || input.multipleSeated || (input.status === "pending" && input.hasPreferred);
}

export type OfferedLayoutView = { id: string; label: string; isCouplePick: boolean };

/** Offered Library layouts, marking the one the couple picked (matched by source template). */
export function offeredLayoutsView(
  offers: EventFloorPlanOfferWithTemplate[],
  floorPlans: Pick<FloorPlan, "id" | "sourceTemplateId">[],
  coupleSelectedFloorPlanId: string | null,
): OfferedLayoutView[] {
  const pickTemplateId = coupleSelectedFloorPlanId
    ? floorPlans.find((p) => p.id === coupleSelectedFloorPlanId)?.sourceTemplateId ?? null
    : null;
  return offers
    .filter((o) => o.isOffered)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({
      id: o.id,
      label: o.coupleLabel?.trim() || o.templateName,
      isCouplePick: pickTemplateId !== null && o.floorPlanTemplateId === pickTemplateId,
    }));
}

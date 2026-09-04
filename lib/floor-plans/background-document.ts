/**
 * Floor Plan Phase 2 — document-backed backgrounds (pure helpers).
 *
 * Document = source of record for the uploaded file.
 * background_image_url = what the editor/portal renders (legacy URL, same
 * image URL, or a technical derivative such as PDF page-1). Derivatives are
 * never second Documents.
 */

export type FloorPlanBackgroundRef = {
  backgroundImageUrl: string | null;
  backgroundDocumentId: string | null;
};

/** Canvas / print / portal always read the render URL — never invent one from the Document id alone. */
export function resolveFloorPlanBackgroundImageUrl(
  plan: FloorPlanBackgroundRef,
): string | null {
  return plan.backgroundImageUrl;
}

export function isLegacyBackgroundOnly(plan: FloorPlanBackgroundRef): boolean {
  return plan.backgroundDocumentId == null && plan.backgroundImageUrl != null;
}

export function isDocumentBackedBackground(plan: FloorPlanBackgroundRef): boolean {
  return plan.backgroundDocumentId != null;
}

/** True when removing the plan background should clear both URL and Document FK. */
export function backgroundClearPatch(): {
  backgroundImageUrl: null;
  backgroundDocumentId: null;
  backgroundImageOpacity: number;
} {
  return {
    backgroundImageUrl: null,
    backgroundDocumentId: null,
    backgroundImageOpacity: 0.25,
  };
}

export function isFloorPlanSourceMime(mimeType: string): boolean {
  if (mimeType.startsWith("image/")) return true;
  return mimeType === "application/pdf";
}

export function isPdfMime(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

/**
 * Association guidance for Migration Center / upload (no parallel storage model):
 * - Event-specific plan → documents.event_id + floor_plans.event_id
 * - Space / reusable master template → venue-level document + floor_plan_templates.space_id
 * - General reference → venue-level document (category floor_plan)
 */
export type FloorPlanDocumentAssociation =
  | { kind: "event"; eventId: string }
  | { kind: "venue_reference" };

export function documentScopeForFloorPlanAssociation(
  association: FloorPlanDocumentAssociation,
): { entityType: "event"; entityId: string } | { venueLevel: true } {
  if (association.kind === "event") {
    return { entityType: "event", entityId: association.eventId };
  }
  return { venueLevel: true };
}

/**
 * Setup Profile starting defaults / references.
 * Stored on venue_setup_profiles.template_refs and snapshotted onto
 * event_setup_states.inherited_template_refs at book time.
 * A reference is not an applied event artifact.
 */

export type SetupTemplateRefs = {
  planningPlaybookTemplateId?: string | null;
  /** Setup Profile default timeline — applied once at book when Timeline is included. */
  timelineTemplateId?: string | null;
  /**
   * Legacy: additional timeline template ids. No longer edited in Setup Profile.
   * Still parsed for old snapshots; never auto-merged onto the event.
   */
  timelineTemplateIds?: string[];
  /**
   * Legacy: multi-select floor-plan option ids. No longer edited in Setup Profile.
   * Still parsed for old snapshots; booking does not create floor plans from these.
   */
  floorPlanTemplateIds?: string[];
  /** Setup Profile preferred/default starting floor-plan template. */
  defaultFloorPlanTemplateId?: string | null;
  questionnaireTemplateIds?: string[];
  inventoryTemplateId?: string | null;
  eventOrderTemplateId?: string | null;
  requiredVendorIds?: string[];
  recommendedVendorIds?: string[];
};

function asId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const id = asId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseTemplateRefs(raw: unknown): SetupTemplateRefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const floorPlanTemplateIds = asIdList(row.floorPlanTemplateIds);
  const defaultFloorPlanTemplateId = asId(row.defaultFloorPlanTemplateId);
  const requiredVendorIds = asIdList(row.requiredVendorIds);
  const required = new Set(requiredVendorIds);
  const timelineTemplateId = asId(row.timelineTemplateId);
  return {
    planningPlaybookTemplateId: asId(row.planningPlaybookTemplateId),
    timelineTemplateId,
    timelineTemplateIds: asIdList(row.timelineTemplateIds).filter((id) => id !== timelineTemplateId),
    floorPlanTemplateIds,
    // Preferred starting plan is independent of the legacy multi-select list.
    defaultFloorPlanTemplateId,
    questionnaireTemplateIds: asIdList(row.questionnaireTemplateIds),
    inventoryTemplateId: asId(row.inventoryTemplateId),
    eventOrderTemplateId: asId(row.eventOrderTemplateId),
    requiredVendorIds,
    recommendedVendorIds: asIdList(row.recommendedVendorIds).filter((id) => !required.has(id)),
  };
}

export function serializeTemplateRefs(refs: SetupTemplateRefs): SetupTemplateRefs {
  return parseTemplateRefs(refs);
}

export function emptyTemplateRefs(): SetupTemplateRefs {
  return {};
}

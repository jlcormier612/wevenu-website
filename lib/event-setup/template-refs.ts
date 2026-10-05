/**
 * Setup Profile starting defaults / references.
 * Stored on venue_setup_profiles.template_refs and snapshotted onto
 * event_setup_states.inherited_template_refs at book time.
 * A reference is not an applied event artifact.
 */

export type SetupTemplateRefs = {
  planningPlaybookTemplateId?: string | null;
  timelineTemplateId?: string | null;
  /** Additional timeline templates. Never auto-merged onto the event. */
  timelineTemplateIds?: string[];
  floorPlanTemplateIds?: string[];
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
    defaultFloorPlanTemplateId:
      defaultFloorPlanTemplateId && floorPlanTemplateIds.includes(defaultFloorPlanTemplateId)
        ? defaultFloorPlanTemplateId
        : null,
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

/**
 * Floor plan required vs placed. Pure comparison of Event Order quantities
 * (lines linked to inventory directly or through their offering) with what is
 * placed on one layout. Informational only: never writes, bills, or blocks.
 */

export const FLOOR_PLAN_SETUP_NAME_SUGGESTIONS = ["Ceremony", "Cocktail hour", "Reception"] as const;

export type RvpSetup = {
  id: string;
  name: string;
  memberPlanIds: string[];
  operationalPlanId: string | null;
  coupleSelectedPlanId?: string | null;
};

export type RvpSection = {
  id: string;
  name: string;
  /** Legacy direct link to one layout. */
  floorPlanId?: string | null;
  floorPlanSetupId?: string | null;
  floorPlanSetupName?: string | null;
  notOnFloorPlan?: boolean;
};

export type RvpLine = {
  sectionId: string | null;
  /** Line's own inventory item, else its offering's linked inventory item. */
  inventoryItemId: string | null;
  quantity: number;
};

export type RvpItem = {
  id: string;
  name: string;
  availableForFloorPlans: boolean;
  countsAsSeats?: boolean;
};

export type RvpObject = {
  inventoryItemId: string | null;
  capacity: number | null;
};

export type SectionSetupResolution =
  | { kind: "not_on_floor_plan" }
  | { kind: "setup"; setupId: string; setupName: string; how: "chosen" | "template" | "name" }
  | { kind: "plan"; planId: string }
  | { kind: "every_layout"; reason: "no_setups" | "unmatched" };

export type RvpRowStatus = "short" | "over" | "ok" | "not_ordered";

export type RvpRow = {
  key: string;
  label: string;
  required: number;
  placed: number;
  status: RvpRowStatus;
  isSeats: boolean;
};

export type RequiredVsPlaced = {
  planSetup: { id: string; name: string } | null;
  /** Event has setups but this layout belongs to none — compared with the whole Event Order. */
  planOutsideSetups: boolean;
  comparedSectionNames: string[];
  /** Sections with floor-plan items that match no setup (event has setups). Counted on every layout. */
  unmatchedSections: { id: string; name: string }[];
  rows: RvpRow[];
  shortCount: number;
};

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolveSectionSetup(section: RvpSection, setups: RvpSetup[]): SectionSetupResolution {
  if (section.notOnFloorPlan) return { kind: "not_on_floor_plan" };
  if (section.floorPlanSetupId) {
    const chosen = setups.find((s) => s.id === section.floorPlanSetupId);
    if (chosen) return { kind: "setup", setupId: chosen.id, setupName: chosen.name, how: "chosen" };
  }
  if (section.floorPlanId) return { kind: "plan", planId: section.floorPlanId };
  if (setups.length === 0) return { kind: "every_layout", reason: "no_setups" };
  const templateName = normalizeName(section.floorPlanSetupName);
  if (templateName) {
    const byTemplate = setups.find((s) => normalizeName(s.name) === templateName);
    if (byTemplate) return { kind: "setup", setupId: byTemplate.id, setupName: byTemplate.name, how: "template" };
  }
  const byName = setups.find((s) => normalizeName(s.name) === normalizeName(section.name));
  if (byName) return { kind: "setup", setupId: byName.id, setupName: byName.name, how: "name" };
  return { kind: "every_layout", reason: "unmatched" };
}

/** The layout a setup is judged on: venue's operational layout, else the couple's pick, else the first layout. */
export function comparisonPlanForSetup(setup: RvpSetup): string | null {
  return setup.operationalPlanId ?? setup.coupleSelectedPlanId ?? setup.memberPlanIds[0] ?? null;
}

function sectionAppliesToPlan(
  resolution: SectionSetupResolution,
  planId: string,
  planSetupId: string | null,
  planOutsideSetups: boolean,
): boolean {
  switch (resolution.kind) {
    case "not_on_floor_plan": return false;
    case "every_layout": return true;
    case "plan": return resolution.planId === planId;
    case "setup": return planOutsideSetups || resolution.setupId === planSetupId;
  }
}

function rowStatus(required: number, placed: number): RvpRowStatus {
  if (required === 0) return "not_ordered";
  if (placed < required) return "short";
  if (placed > required) return "over";
  return "ok";
}

export function computeRequiredVsPlaced(input: {
  planId: string;
  setups: RvpSetup[];
  sections: RvpSection[];
  lines: RvpLine[];
  items: RvpItem[];
  /** Objects on this layout only. */
  objects: RvpObject[];
}): RequiredVsPlaced {
  const planSetup = input.setups.find((s) => s.memberPlanIds.includes(input.planId)) ?? null;
  const planOutsideSetups = input.setups.length > 0 && !planSetup;
  const itemById = new Map(input.items.filter((i) => i.availableForFloorPlans).map((i) => [i.id, i]));
  const isFloorPlanLine = (l: RvpLine) => l.inventoryItemId != null && itemById.has(l.inventoryItemId);

  const resolutionBySection = new Map(input.sections.map((s) => [s.id, resolveSectionSetup(s, input.setups)]));
  const appliesBySection = new Map(input.sections.map((s) => [
    s.id,
    sectionAppliesToPlan(resolutionBySection.get(s.id)!, input.planId, planSetup?.id ?? null, planOutsideSetups),
  ]));

  const unmatchedSections = input.sections
    .filter((s) => {
      const r = resolutionBySection.get(s.id)!;
      return r.kind === "every_layout" && r.reason === "unmatched"
        && input.lines.some((l) => l.sectionId === s.id && isFloorPlanLine(l));
    })
    .map((s) => ({ id: s.id, name: s.name }));

  const comparedLines = input.lines.filter((l) =>
    isFloorPlanLine(l) && (l.sectionId == null || appliesBySection.get(l.sectionId) === true));
  const comparedSectionNames = input.sections
    .filter((s) => appliesBySection.get(s.id) && comparedLines.some((l) => l.sectionId === s.id))
    .map((s) => s.name);

  const requiredByItem = new Map<string, number>();
  for (const l of comparedLines) {
    requiredByItem.set(l.inventoryItemId!, (requiredByItem.get(l.inventoryItemId!) ?? 0) + Number(l.quantity || 0));
  }
  const placedByItem = new Map<string, number>();
  for (const o of input.objects) {
    if (o.inventoryItemId) placedByItem.set(o.inventoryItemId, (placedByItem.get(o.inventoryItemId) ?? 0) + 1);
  }

  const rows: RvpRow[] = [];

  const seatItems = [...itemById.values()].filter((i) => i.countsAsSeats);
  const seatIds = new Set(seatItems.map((i) => i.id));
  const seatsRequired = seatItems.reduce((sum, i) => sum + (requiredByItem.get(i.id) ?? 0), 0);
  if (seatsRequired > 0) {
    const seatsAtTables = input.objects
      .filter((o) => !(o.inventoryItemId && seatIds.has(o.inventoryItemId)))
      .reduce((sum, o) => sum + Math.max(0, Number(o.capacity ?? 0)), 0);
    const chairsPlaced = seatItems.reduce((sum, i) => sum + (placedByItem.get(i.id) ?? 0), 0);
    const names = seatItems.filter((i) => (requiredByItem.get(i.id) ?? 0) > 0).map((i) => i.name);
    const placed = seatsAtTables + chairsPlaced;
    rows.push({
      key: "seats",
      label: `Seats (${names.join(", ")})`,
      required: seatsRequired,
      placed,
      status: rowStatus(seatsRequired, placed),
      isSeats: true,
    });
  }

  const otherIds = new Set<string>();
  for (const id of requiredByItem.keys()) if (!seatIds.has(id)) otherIds.add(id);
  for (const id of placedByItem.keys()) if (itemById.has(id) && !seatIds.has(id)) otherIds.add(id);
  const others = [...otherIds]
    .map((id) => {
      const required = requiredByItem.get(id) ?? 0;
      const placed = placedByItem.get(id) ?? 0;
      return { key: id, label: itemById.get(id)!.name, required, placed, status: rowStatus(required, placed), isSeats: false };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  rows.push(...others);

  return {
    planSetup: planSetup ? { id: planSetup.id, name: planSetup.name } : null,
    planOutsideSetups,
    comparedSectionNames,
    unmatchedSections,
    rows,
    shortCount: rows.filter((r) => r.status === "short").length,
  };
}

export function rowSentence(row: RvpRow): string {
  // Soft informational note — furniture placed for seating/décor often has no EO line.
  if (row.status === "not_ordered") {
    return `${row.placed} on this layout · not listed on the Event Order`;
  }
  const base = `${row.required} required · ${row.placed} placed`;
  if (row.status === "short") return `${base} · ${row.required - row.placed} short`;
  if (row.status === "over") return `${base} · ${row.placed - row.required} over`;
  return base;
}

/** One-line status for a layout, e.g. "2 items short". */
export function summarySentence(result: RequiredVsPlaced): string {
  const ordered = result.rows.filter((r) => r.status !== "not_ordered");
  if (ordered.length === 0) return "Nothing on the Event Order to compare yet";
  if (result.shortCount === 0) return "Everything on the Event Order is placed";
  return `${result.shortCount} ${result.shortCount === 1 ? "item" : "items"} short`;
}

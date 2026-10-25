/**
 * Floor Plan Template — layout purpose (room arrangement), distinct from
 * booking event_type (Wedding, Reception Only as a booking kind, etc.).
 *
 * Derived only from source_master_key — no schema column. Custom templates
 * without a starter key are "custom".
 */

import {
  FLOOR_PLAN_STARTER_MASTERS,
  LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY,
} from "@/lib/floor-plan-templates/starters";

export const FLOOR_PLAN_LAYOUT_PURPOSE_ANY = "__any_layout__";

export type FloorPlanLayoutPurpose =
  | "ceremony"
  | "cocktail"
  | "reception"
  | "same_room_flip"
  | "blank"
  | "combined"
  | "custom";

export type FloorPlanLayoutPurposeOption = {
  value: typeof FLOOR_PLAN_LAYOUT_PURPOSE_ANY | FloorPlanLayoutPurpose;
  label: string;
};

const PURPOSE_BY_MASTER_KEY: Record<string, FloorPlanLayoutPurpose> = {
  "FP-03": "ceremony",
  "FP-04": "cocktail",
  "FP-02": "reception",
  "FP-SR": "same_room_flip",
  "FP-05": "blank",
  [LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY]: "combined",
};

const PURPOSE_LABELS: Record<FloorPlanLayoutPurpose, string> = {
  ceremony: "Ceremony",
  cocktail: "Cocktail Hour",
  reception: "Reception Only",
  same_room_flip: "Same-Room Flip",
  blank: "Blank Floor Plan",
  combined: "Ceremony + Reception",
  custom: "Custom layout",
};

/** Ordered options for Library filter (All + known purposes that appear in catalog). */
export const FLOOR_PLAN_LAYOUT_PURPOSE_FILTER_OPTIONS: FloorPlanLayoutPurposeOption[] = [
  { value: FLOOR_PLAN_LAYOUT_PURPOSE_ANY, label: "All layouts" },
  { value: "ceremony", label: PURPOSE_LABELS.ceremony },
  { value: "cocktail", label: PURPOSE_LABELS.cocktail },
  { value: "reception", label: PURPOSE_LABELS.reception },
  { value: "same_room_flip", label: PURPOSE_LABELS.same_room_flip },
  { value: "blank", label: PURPOSE_LABELS.blank },
  { value: "combined", label: PURPOSE_LABELS.combined },
  { value: "custom", label: PURPOSE_LABELS.custom },
];

export function layoutPurposeFromSourceMasterKey(
  sourceMasterKey: string | null | undefined,
): FloorPlanLayoutPurpose {
  if (!sourceMasterKey) return "custom";
  return PURPOSE_BY_MASTER_KEY[sourceMasterKey] ?? "custom";
}

export function layoutPurposeLabel(purpose: FloorPlanLayoutPurpose): string {
  return PURPOSE_LABELS[purpose];
}

export function layoutPurposeLabelForTemplate(sourceMasterKey: string | null | undefined): string {
  return layoutPurposeLabel(layoutPurposeFromSourceMasterKey(sourceMasterKey));
}

/** True when a Library template row matches the layout-purpose filter. */
export function templateMatchesLayoutPurposeFilter(
  sourceMasterKey: string | null | undefined,
  filter: string,
): boolean {
  if (filter === FLOOR_PLAN_LAYOUT_PURPOSE_ANY) return true;
  return layoutPurposeFromSourceMasterKey(sourceMasterKey) === filter;
}

/** Sanity: every current starter master has an explicit purpose mapping. */
export function assertStarterLayoutPurposesMapped(): void {
  for (const master of FLOOR_PLAN_STARTER_MASTERS) {
    if (!PURPOSE_BY_MASTER_KEY[master.key]) {
      throw new Error(`Missing layout purpose for starter ${master.key}`);
    }
  }
}

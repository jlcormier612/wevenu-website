/**
 * Floor plan reference data, object definitions, and canvas constants.
 */
import type { ObjectType } from "@/lib/floor-plans/types";

// ---- Canvas ----------------------------------------------------------------

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// ---- Object type definitions -----------------------------------------------

export type ObjectTypeMeta = {
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultLabel: string;
  defaultCapacity: number | null;
  shape: "circle" | "rect" | "oval" | "text";
};

export const OBJECT_TYPES: Record<ObjectType, ObjectTypeMeta> = {
  table_round:  { label: "Round Table",  defaultWidth: 72,  defaultHeight: 72,  defaultLabel: "T1",  defaultCapacity: 8,  shape: "circle" },
  table_rect:   { label: "Rect. Table",  defaultWidth: 120, defaultHeight: 60,  defaultLabel: "T1",  defaultCapacity: 8,  shape: "rect"   },
  table_oval:   { label: "Oval Table",   defaultWidth: 130, defaultHeight: 70,  defaultLabel: "T1",  defaultCapacity: 10, shape: "oval"   },
  stage:        { label: "Stage",        defaultWidth: 200, defaultHeight: 80,  defaultLabel: "Stage", defaultCapacity: null, shape: "rect" },
  dance_floor:  { label: "Dance Floor",  defaultWidth: 160, defaultHeight: 160, defaultLabel: "Dance Floor", defaultCapacity: null, shape: "rect" },
  bar:          { label: "Bar",          defaultWidth: 140, defaultHeight: 50,  defaultLabel: "Bar", defaultCapacity: null, shape: "rect"  },
  gift_table:   { label: "Gift Table",   defaultWidth: 90,  defaultHeight: 40,  defaultLabel: "Gifts", defaultCapacity: null, shape: "rect" },
  cake_table:   { label: "Cake Table",   defaultWidth: 60,  defaultHeight: 40,  defaultLabel: "Cake", defaultCapacity: null, shape: "rect"  },
  text_label:   { label: "Text Label",   defaultWidth: 80,  defaultHeight: 30,  defaultLabel: "Label", defaultCapacity: null, shape: "text" },
  other:        { label: "Other",        defaultWidth: 80,  defaultHeight: 80,  defaultLabel: "", defaultCapacity: null, shape: "rect"   },
};

/** Object fill / stroke colors (palette-only). */
export const OBJECT_STYLE: Record<ObjectType, { fill: string; stroke: string; textFill: string }> = {
  table_round:  { fill: "#ffffff", stroke: "#4F5F4F", textFill: "#4F5F4F" },
  table_rect:   { fill: "#ffffff", stroke: "#4F5F4F", textFill: "#4F5F4F" },
  table_oval:   { fill: "#ffffff", stroke: "#4F5F4F", textFill: "#4F5F4F" },
  stage:        { fill: "#F5F4F2", stroke: "#5D6F5D", textFill: "#4F5F4F" },
  dance_floor:  { fill: "#B9D1C2", stroke: "#5D6F5D", textFill: "#4F5F4F" },
  bar:          { fill: "#DED6CA", stroke: "#B8AEA1", textFill: "#4F5F4F" },
  gift_table:   { fill: "#F5F4F2", stroke: "#B8AEA1", textFill: "#4F5F4F" },
  cake_table:   { fill: "#F5F4F2", stroke: "#D8A7AA", textFill: "#4F5F4F" },
  text_label:   { fill: "transparent", stroke: "transparent", textFill: "#4F5F4F" },
  other:        { fill: "#F7F5F1", stroke: "#B8AEA1", textFill: "#4F5F4F" },
};

/** Auto-number a new object by finding the highest existing number of that type. */
export function nextObjectLabel(existing: Array<{ objectType: ObjectType; label: string | null }>, type: ObjectType): string {
  const base = OBJECT_TYPES[type].defaultLabel;
  if (!base) return "";
  // Extract numeric suffixes for this type
  const nums = existing
    .filter((o) => o.objectType === type && o.label?.startsWith(base.slice(0, -1) ?? base))
    .map((o) => parseInt(o.label?.replace(/\D/g, "") ?? "0", 10))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  // If the base already ends in a digit, just use the base + next
  return `${base.replace(/\d+$/, "")}${next}`;
}

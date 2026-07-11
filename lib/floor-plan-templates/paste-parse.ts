/**
 * "Paste Existing Layout" — deterministic, non-AI text parsing (no Luv
 * involved). Each non-empty pasted line becomes one canvas object, arranged
 * in a simple grid. A number anywhere in the line becomes its capacity; a
 * handful of keywords ("stage", "dance floor", "bar", "gift", "cake",
 * "oval", "rect", "round") pick the object type — everything else defaults
 * to a round table. Positioning a floor plan spatially from a text
 * description is a much harder, more speculative problem than the
 * line-to-checklist-item parsing Planning/Timeline import already does, so
 * this stays a plain, predictable layout generator rather than guessing.
 */

import { CANVAS_WIDTH } from "@/lib/floor-plans/constants";
import type { AddObjectInput } from "@/lib/floor-plans/types";
import type { ObjectType } from "@/lib/floor-plans/types";

const KEYWORD_TYPES: [RegExp, ObjectType][] = [
  [/dance\s*floor/i, "dance_floor"],
  [/\bstage\b/i, "stage"],
  [/\bbar\b/i, "bar"],
  [/gift/i, "gift_table"],
  [/cake/i, "cake_table"],
  [/oval/i, "table_oval"],
  [/rect(angle|angular)?/i, "table_rect"],
  [/round/i, "table_round"],
];

const GRID_COLUMNS = 4;
const ROW_HEIGHT = 130;
const TOP_MARGIN = 100;

export function parsePastedLayout(text: string): AddObjectInput[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const spacingX = CANVAS_WIDTH / (GRID_COLUMNS + 1);

  return lines.map((line, i) => {
    const capacityMatch = line.match(/(\d+)/);
    const capacity = capacityMatch ? parseInt(capacityMatch[1], 10) : undefined;
    const objectType = KEYWORD_TYPES.find(([re]) => re.test(line))?.[1] ?? "table_round";
    const label = line.replace(/[-–—:]+/g, " ").trim().slice(0, 40);
    const col = i % GRID_COLUMNS;
    const row = Math.floor(i / GRID_COLUMNS);

    return {
      objectType, label, capacity,
      x: spacingX * (col + 1),
      y: TOP_MARGIN + ROW_HEIGHT * row,
    };
  });
}

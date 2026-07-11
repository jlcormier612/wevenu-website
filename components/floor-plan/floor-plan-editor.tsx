"use client";

/**
 * Floor Plan Editor (Floor Plan Editor Completion, Phase 1).
 *
 * Canvas: a room-sized SVG canvas. Canvas units are always inches — an
 * Inventory item's own width/length are already plain-number inches (a
 * "60" Round" table has width = 60). A plan's canvas is exactly
 * roomWidthFt*12 x roomDepthFt*12 units, so 1 foot is always 12 canvas
 * units regardless of the room's configured size. Existing floor plans
 * were backfilled to 800x600-equivalent room dimensions (66.67 x 50 ft) so
 * every already-placed object's position relative to the room boundary is
 * numerically unchanged by that migration.
 *
 * Interactions:
 * - Palette: pick a category, then an item within it → mode becomes 'add'
 * - Canvas click in add mode: inserts the object at the clicked position
 * - Object click in select mode: selects the object
 * - Drag selected object body: repositions it (unless locked)
 * - Drag a corner handle: resizes around the object's own center
 * - Drag the handle above the object: rotates it
 * - Drag empty canvas: pans the view
 * - Properties panel: label, dimensions, rotation, color, notes, lock, delete
 * - Selection toolbar: duplicate, bring forward, send back
 * - Background: upload/remove/opacity/lock, unchanged in spirit since Sprint 18
 */

import * as React from "react";

import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Grid3x3,
  Image as ImageIcon,
  Loader2,
  Lock,
  Magnet,
  Maximize2,
  Printer,
  RotateCcw,
  Settings2,
  Trash2,
  Unlock,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import {
  addObjectAction,
  clearFloorPlanAction,
  createFloorPlanAction,
  deleteObjectAction,
  reorderObjectAction,
  setBackgroundLockedAction,
  updateBackgroundAction,
  updateObjectAction,
  updateRoomSettingsAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/integrations/supabase/client";
import {
  DISPLAY_SHAPES, DISPLAY_SHAPE_LABELS, DISPLAY_SHAPE_STYLE, FloorPlanShapeSvg,
} from "@/components/floor-plan/floor-plan-shapes";
import { OBJECT_STYLE, OBJECT_TYPES, nextObjectLabel } from "@/lib/floor-plans/constants";
import type {
  DisplayShape,
  FloorPlanCanvasObject,
  FloorPlanCanvasPlan,
  FloorPlanEditorActions,
  MeasurementUnit,
  ObjectType,
} from "@/lib/floor-plans/types";
import type { InventoryCategory, InventoryItem, InventoryUsage } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

const INCHES_PER_FOOT = 12;
const GRID_INTERVALS_FT = [1, 2, 5, 10];
const MIN_OBJECT_SIZE = 10;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

// ---- View preferences (Floor Plan Completion — Phase 2) ---------------------
// Editor preferences, not Floor Plan data (Requirement 4): one shared key,
// never a column on floor_plans/floor_plan_templates, so opening a
// different plan never resets — or duplicates — how you like to view the
// canvas. Pan is stored as a fraction of the canvas so it transfers
// sensibly between plans of different room sizes rather than as a raw,
// plan-specific pixel offset.
const VIEW_PREFS_KEY = "wevenu:floor-plan-editor-view-prefs";

type ViewPrefs = {
  zoom: number; showGrid: boolean; snapToGrid: boolean; gridIntervalFt: number;
  panXRatio: number; panYRatio: number;
};

const DEFAULT_VIEW_PREFS: ViewPrefs = {
  zoom: 1, showGrid: true, snapToGrid: true, gridIntervalFt: 5, panXRatio: 0, panYRatio: 0,
};

function loadViewPrefs(): ViewPrefs {
  if (typeof window === "undefined") return DEFAULT_VIEW_PREFS;
  try {
    const raw = window.localStorage.getItem(VIEW_PREFS_KEY);
    if (!raw) return DEFAULT_VIEW_PREFS;
    return { ...DEFAULT_VIEW_PREFS, ...(JSON.parse(raw) as Partial<ViewPrefs>) };
  } catch {
    return DEFAULT_VIEW_PREFS;
  }
}

// ---- Measurement formatting --------------------------------------------------

function splitFeetInches(totalFeet: number): { ft: number; inch: number } {
  const ft = Math.floor(totalFeet);
  const inch = Math.round((totalFeet - ft) * INCHES_PER_FOOT);
  return inch === INCHES_PER_FOOT ? { ft: ft + 1, inch: 0 } : { ft, inch };
}

function formatRoomSize(feet: number, unit: MeasurementUnit): string {
  if (unit === "decimal_feet") return `${feet.toFixed(1)} ft`;
  const { ft, inch } = splitFeetInches(feet);
  return inch > 0 ? `${ft}' ${inch}"` : `${ft}'`;
}

// ---- SVG object rendering --------------------------------------------------

type Corner = "nw" | "ne" | "sw" | "se";
const CORNERS: { corner: Corner; sx: -1 | 1; sy: -1 | 1 }[] = [
  { corner: "nw", sx: -1, sy: -1 },
  { corner: "ne", sx: 1, sy: -1 },
  { corner: "sw", sx: -1, sy: 1 },
  { corner: "se", sx: 1, sy: 1 },
];

function SvgObject({
  obj,
  selected,
  onPointerDown,
  onResizeStart,
  onRotateStart,
}: {
  obj: FloorPlanCanvasObject;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, corner: Corner) => void;
  onRotateStart: (e: React.PointerEvent, id: string) => void;
}) {
  const meta = OBJECT_TYPES[obj.objectType];
  // The shape library (Floor Plan Completion — Phase 2) renders whenever an
  // object carries a displayShape; objects placed before it existed (or
  // Text Label, which isn't inventory-backed) fall back to the original
  // object_type-based rendering exactly as before this shape library existed.
  const legacyStyle = OBJECT_STYLE[obj.objectType];
  const style = obj.displayShape ? DISPLAY_SHAPE_STYLE[obj.displayShape] : legacyStyle;
  const fill = obj.color ?? style.fill;
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const fontSize = Math.max(9, Math.min(14, obj.width / 6));
  const handleSize = 9;

  return (
    <g
      transform={`rotate(${obj.rotation}, ${obj.x}, ${obj.y})`}
      className={obj.locked ? "cursor-not-allowed" : "cursor-pointer"}
      onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, obj.id); }}
    >
      {/* Shape */}
      {obj.objectType === "text_label" ? (
        null // text-only, rendered below
      ) : obj.displayShape ? (
        <FloorPlanShapeSvg
          shape={obj.displayShape} x={obj.x} y={obj.y} width={obj.width} height={obj.height}
          fill={fill} stroke={style.stroke} strokeWidth={selected ? 2.5 : 1.5}
        />
      ) : obj.objectType === "table_round" ? (
        <circle cx={obj.x} cy={obj.y} r={hw}
          fill={fill} stroke={style.stroke} strokeWidth={selected ? 2.5 : 1.5} />
      ) : obj.objectType === "table_oval" ? (
        <ellipse cx={obj.x} cy={obj.y} rx={hw} ry={hh}
          fill={fill} stroke={style.stroke} strokeWidth={selected ? 2.5 : 1.5} />
      ) : (
        <rect x={obj.x - hw} y={obj.y - hh} width={obj.width} height={obj.height} rx={4}
          fill={fill} stroke={style.stroke} strokeWidth={selected ? 2.5 : 1.5} />
      )}

      {/* Label */}
      {(obj.label || meta.defaultLabel) && obj.objectType !== "text_label" && (
        <text x={obj.x} y={obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fill={style.textFill} fontFamily="sans-serif"
          style={{ userSelect: "none", pointerEvents: "none" }}>
          {obj.label ?? ""}
        </text>
      )}

      {/* Text label type */}
      {obj.objectType === "text_label" && (
        <text x={obj.x} y={obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={14} fill={style.textFill} fontFamily="sans-serif" fontWeight="500"
          style={{ userSelect: "none", pointerEvents: "none" }}>
          {obj.label ?? "Label"}
        </text>
      )}

      {/* Lock indicator */}
      {obj.locked && (
        <g transform={`translate(${obj.x + hw - 10}, ${obj.y - hh + 10})`} style={{ pointerEvents: "none" }}>
          <circle r={9} fill="white" stroke="#B8AEA1" strokeWidth={1} />
          <path d="M-3.5,-0.5 v-2 a3.5,3.5 0 0 1 7,0 v2 M-4,-0.5 h8 v6 h-8 z" fill="none" stroke="#8E978E" strokeWidth={1.1} />
        </g>
      )}

      {/* Selection indicator + handles */}
      {selected && (
        <>
          <rect x={obj.x - hw - 4} y={obj.y - hh - 4}
            width={obj.width + 8} height={obj.height + 8} rx={3}
            fill="none" stroke="#5D6F5D" strokeWidth={1.5} strokeDasharray="5,3" />
          {!obj.locked && (
            <>
              <line x1={obj.x} y1={obj.y - hh} x2={obj.x} y2={obj.y - hh - 20} stroke="#5D6F5D" strokeWidth={1.5} />
              <circle
                cx={obj.x} cy={obj.y - hh - 20} r={7}
                fill="#5D6F5D" stroke="white" strokeWidth={1.5}
                className="cursor-grab"
                onPointerDown={(e) => { e.stopPropagation(); onRotateStart(e, obj.id); }}
              />
              {CORNERS.map(({ corner, sx, sy }) => (
                <rect
                  key={corner}
                  x={obj.x + sx * hw - handleSize / 2}
                  y={obj.y + sy * hh - handleSize / 2}
                  width={handleSize} height={handleSize}
                  fill="white" stroke="#5D6F5D" strokeWidth={1.5}
                  className={sx === sy ? "cursor-nwse-resize" : "cursor-nesw-resize"}
                  onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, obj.id, corner); }}
                />
              ))}
            </>
          )}
        </>
      )}
    </g>
  );
}

// ---- Category-organized palette ----------------------------------------------

type AddSource = {
  objectType: ObjectType;
  toolbarLabel: string;
  fixedLabel?: string;
  width?: number;
  height?: number;
  color?: string;
  displayShape?: DisplayShape;
  inventoryItemId?: string;
};

const TEXT_LABEL_SOURCE: AddSource = { objectType: "text_label", toolbarLabel: "Text Label" };
const LABELS_CATEGORY_ID = "__labels__";
const UNCATEGORIZED_ID = "__uncategorized__";

/**
 * An Inventory item's declared shape becomes the placed object's
 * displayShape (Floor Plan Completion — Phase 2's shape library renders
 * it); object_type stays the same coarse fallback category it always was,
 * used only when no displayShape is present.
 */
function inventoryToAddSource(item: InventoryItem): AddSource {
  const objectType: ObjectType =
    item.shape === "round" || item.shape === "cocktail" ? "table_round"
    : item.shape === "oval" ? "table_oval"
    : item.shape === "rectangular" || item.shape === "square" ? "table_rect"
    : "other";
  const label = item.printableName?.trim() || item.name;
  return {
    objectType,
    toolbarLabel: label,
    fixedLabel: label,
    width: item.width ?? undefined,
    height: item.length ?? undefined, // floor "length" (depth) becomes the canvas Y-extent
    color: item.color ?? undefined,
    displayShape: item.shape ?? undefined,
    inventoryItemId: item.id,
  };
}

// ---- Properties panel -------------------------------------------------------

function PropertiesPanel({
  obj,
  onUpdate,
  onDuplicate,
  onDelete,
  onReorder,
}: {
  obj: FloorPlanCanvasObject;
  onUpdate: (id: string, patch: Partial<FloorPlanCanvasObject>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, direction: "forward" | "backward") => void;
}) {
  return (
    <div className="space-y-3 p-3 border border-border bg-card rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {OBJECT_TYPES[obj.objectType].label}
        </p>
        {obj.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs flex-1"
          onClick={() => onDuplicate(obj.id)} disabled={obj.locked} title="Duplicate this object">
          <Copy className="h-3 w-3 mr-1" /> Duplicate
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" title="Bring forward (in front of overlapping objects)"
          onClick={() => onReorder(obj.id, "forward")}>
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" title="Send backward (behind overlapping objects)"
          onClick={() => onReorder(obj.id, "backward")}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={obj.label ?? ""}
            onChange={(e) => onUpdate(obj.id, { label: e.target.value })}
            className="h-7 text-xs"
            disabled={obj.locked}
          />
        </div>
        {obj.objectType.startsWith("table") && (
          <div className="space-y-1">
            <Label className="text-xs">Seats</Label>
            <Input
              type="number"
              value={obj.capacity ?? ""}
              onChange={(e) => onUpdate(obj.id, { capacity: parseInt(e.target.value) || null })}
              className="h-7 text-xs w-20"
              placeholder="0"
              disabled={obj.locked}
            />
          </div>
        )}
      </div>

      {/* Size & Rotation */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Size &amp; Rotation</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Width (in)</Label>
            <Input
              type="number"
              value={Math.round(obj.width)}
              onChange={(e) => onUpdate(obj.id, { width: Math.max(MIN_OBJECT_SIZE, Number(e.target.value)) })}
              className="h-7 text-xs"
              disabled={obj.locked}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Length (in)</Label>
            <Input
              type="number"
              value={Math.round(obj.height)}
              onChange={(e) => onUpdate(obj.id, { height: Math.max(MIN_OBJECT_SIZE, Number(e.target.value)) })}
              className="h-7 text-xs"
              disabled={obj.locked}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rotation (°)</Label>
          <Input
            type="number"
            value={obj.rotation}
            onChange={(e) => onUpdate(obj.id, { rotation: Number(e.target.value) % 360 })}
            className="h-7 text-xs w-20"
            disabled={obj.locked}
          />
        </div>
      </div>

      {/* Appearance */}
      {obj.objectType !== "text_label" && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
          <div className="space-y-1">
            <Label className="text-xs">Shape</Label>
            <select
              value={obj.displayShape ?? ""}
              onChange={(e) => onUpdate(obj.id, { displayShape: (e.target.value || null) as FloorPlanCanvasObject["displayShape"] })}
              disabled={obj.locked}
              className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50"
            >
              <option value="">Default</option>
              {DISPLAY_SHAPES.map((s) => <option key={s} value={s}>{DISPLAY_SHAPE_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={obj.color ?? "#ffffff"}
                onChange={(e) => onUpdate(obj.id, { color: e.target.value })}
                className="h-7 w-10 rounded border border-border cursor-pointer disabled:cursor-not-allowed"
                disabled={obj.locked}
              />
              {obj.color && (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => onUpdate(obj.id, { color: null })} disabled={obj.locked} title="Reset to the default color for this shape">
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={obj.notes ?? ""}
          onChange={(e) => onUpdate(obj.id, { notes: e.target.value || null })}
          className="text-xs min-h-14"
          disabled={obj.locked}
        />
      </div>

      {/* Lock & Delete */}
      <div className="space-y-2 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={obj.locked}
            onChange={(e) => onUpdate(obj.id, { locked: e.target.checked })}
          />
          Lock Position
        </label>
        <Button
          type="button" variant="destructive" size="sm" className="w-full"
          onClick={() => onDelete(obj.id)} disabled={obj.locked}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}

// ---- Room settings panel -----------------------------------------------------

function RoomSettingsPanel({
  roomWidthFt, roomDepthFt, measurementUnit, gridIntervalFt,
  onChangeSize, onChangeUnit, onChangeGridInterval, onClose,
}: {
  roomWidthFt: number; roomDepthFt: number; measurementUnit: MeasurementUnit; gridIntervalFt: number;
  onChangeSize: (widthFt: number, depthFt: number) => void;
  onChangeUnit: (unit: MeasurementUnit) => void;
  onChangeGridInterval: (ft: number) => void;
  onClose: () => void;
}) {
  const [width, setWidth] = React.useState(roomWidthFt);
  const [depth, setDepth] = React.useState(roomDepthFt);

  function commit() {
    if (width > 0 && depth > 0) onChangeSize(width, depth);
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-10 w-72 space-y-3 rounded-xl border border-border bg-card p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room Settings</p>
        <button type="button" onClick={onClose} title="Close room settings" className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Room Width (ft)</Label>
          <Input type="number" min={1} step={0.5} value={width}
            onChange={(e) => setWidth(Number(e.target.value))} onBlur={commit} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Room Depth (ft)</Label>
          <Input type="number" min={1} step={0.5} value={depth}
            onChange={(e) => setDepth(Number(e.target.value))} onBlur={commit} className="h-7 text-xs" />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {formatRoomSize(width, measurementUnit)} × {formatRoomSize(depth, measurementUnit)}
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Measurement Unit</Label>
        <select
          value={measurementUnit}
          onChange={(e) => onChangeUnit(e.target.value as MeasurementUnit)}
          className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="feet_inches">Feet &amp; Inches</option>
          <option value="decimal_feet">Decimal Feet</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Grid Spacing</Label>
        <select
          value={gridIntervalFt}
          onChange={(e) => onChangeGridInterval(Number(e.target.value))}
          className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs"
        >
          {GRID_INTERVALS_FT.map((ft) => <option key={ft} value={ft}>{ft} ft</option>)}
        </select>
      </div>
    </div>
  );
}

// ---- Main editor ------------------------------------------------------------

export function FloorPlanEditor({
  initialPlan,
  eventId,
  eventName,
  venueId,
  actions,
  showPrint = true,
  inventoryItems = [],
  inventoryCategories = [],
  inventoryUsage = [],
}: {
  initialPlan: FloorPlanCanvasPlan | null;
  eventId?: string;
  eventName?: string;
  venueId: string;
  /**
   * Points the editor at a booking's floor plan (default, when omitted —
   * behavior identical to before this prop existed) or a reusable Floor
   * Plan Template (Floor Plan Template Library task) — same editor either
   * way, never a second one. Booking mode's own actions/behavior are
   * unchanged.
   */
  actions?: FloorPlanEditorActions;
  showPrint?: boolean;
  /** The palette's available objects (Inventory Foundation task) — active items marked available for Floor Plans, grouped by inventoryCategories (Floor Plan Editor Completion). */
  inventoryItems?: InventoryItem[];
  inventoryCategories?: InventoryCategory[];
  /**
   * Cross-plan usage totals for this booking at load time (Floor Plan
   * Completion — Phase 2, Requirement 2). Informational only — never
   * gates placement. The panel below recomputes "Used" live from the
   * currently-open plan's objects so it doesn't go stale as you edit;
   * this prop only supplies the *other* floor plans' committed usage
   * (usage the editor can't see from its own `objects` state) and each
   * item's venue-wide availability. Omitted entirely for Templates, which
   * aren't tied to a booking's real inventory commitments.
   */
  inventoryUsage?: InventoryUsage[];
}) {
  const boundActions: FloorPlanEditorActions = actions ?? {
    create: () => createFloorPlanAction(eventId!),
    addObject: (planId, input) => addObjectAction(planId, eventId!, input),
    updateObject: (objId, input) => updateObjectAction(objId, input),
    deleteObject: (objId) => deleteObjectAction(objId, eventId!),
    reorderObject: (planId, objId, direction) => reorderObjectAction(planId, objId, eventId!, direction),
    updateBackground: (planId, url, opacity) => updateBackgroundAction(planId, eventId!, url, opacity),
    setBackgroundLocked: (planId, locked) => setBackgroundLockedAction(planId, eventId!, locked),
    updateRoomSettings: (planId, input) => updateRoomSettingsAction(planId, eventId!, input),
    clear: (planId) => clearFloorPlanAction(planId, eventId!),
  };
  const [plan, setPlan] = React.useState<FloorPlanCanvasPlan | null>(initialPlan);
  const [objects, setObjects] = React.useState<FloorPlanCanvasObject[]>(initialPlan?.objects ?? []);
  const [mode, setMode] = React.useState<"select" | "add">("select");
  const [addSource, setAddSource] = React.useState<AddSource | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Category palette
  const categoriesWithItems = React.useMemo(() => {
    const byCategory = new Map<string, InventoryItem[]>();
    for (const item of inventoryItems) {
      const key = item.categoryId ?? UNCATEGORIZED_ID;
      byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
    }
    const ordered = inventoryCategories
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ id: c.id, name: c.name, items: byCategory.get(c.id) ?? [] }))
      .filter((c) => c.items.length > 0);
    const uncategorized = byCategory.get(UNCATEGORIZED_ID) ?? [];
    if (uncategorized.length > 0) ordered.push({ id: UNCATEGORIZED_ID, name: "Uncategorized", items: uncategorized });
    return ordered;
  }, [inventoryItems, inventoryCategories]);
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null);
  const effectiveActiveCategoryId = activeCategoryId ?? categoriesWithItems[0]?.id ?? null;

  // Canvas view: zoom/pan/grid — editor preferences, not Floor Plan data
  // (Requirement 4). Loaded once from the one shared localStorage key so
  // every plan you open remembers how you like to view the canvas, without
  // duplicating the setting per plan.
  const [initialViewPrefs] = React.useState(loadViewPrefs);
  // A brand-new floor plan (nothing placed yet) always opens fit-to-room at
  // 100% zoom, regardless of whatever zoom/pan a previous plan left in the
  // shared view-preference key — first impressions matter most exactly when
  // there's nothing on the canvas yet to orient around. Plans already in
  // progress keep remembering the last view, as before.
  const isFreshPlan = (initialPlan?.objects.length ?? 0) === 0;
  const [zoom, setZoom] = React.useState(isFreshPlan ? 1 : initialViewPrefs.zoom);
  const [pan, setPan] = React.useState(() => (
    isFreshPlan
      ? { x: 0, y: 0 }
      : {
          x: initialViewPrefs.panXRatio * (initialPlan?.roomWidthFt ?? 60) * INCHES_PER_FOOT,
          y: initialViewPrefs.panYRatio * (initialPlan?.roomDepthFt ?? 40) * INCHES_PER_FOOT,
        }
  ));
  const [showGrid, setShowGrid] = React.useState(initialViewPrefs.showGrid);
  const [snapToGrid, setSnapToGrid] = React.useState(initialViewPrefs.snapToGrid);
  const [gridIntervalFt, setGridIntervalFt] = React.useState(initialViewPrefs.gridIntervalFt);
  const [showRoomSettings, setShowRoomSettings] = React.useState(false);

  const canvasWidth = (plan?.roomWidthFt ?? 60) * INCHES_PER_FOOT;
  const canvasHeight = (plan?.roomDepthFt ?? 40) * INCHES_PER_FOOT;
  const gridUnit = gridIntervalFt * INCHES_PER_FOOT;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const prefs: ViewPrefs = {
      zoom, showGrid, snapToGrid, gridIntervalFt,
      panXRatio: canvasWidth > 0 ? pan.x / canvasWidth : 0,
      panYRatio: canvasHeight > 0 ? pan.y / canvasHeight : 0,
    };
    window.localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(prefs));
  }, [zoom, showGrid, snapToGrid, gridIntervalFt, pan, canvasWidth, canvasHeight]);

  type Interaction =
    | { kind: "move"; id: string; origPos: { x: number; y: number } }
    | { kind: "resize"; id: string; corner: Corner; center: { x: number; y: number }; rotation: number }
    | { kind: "rotate"; id: string; center: { x: number; y: number } }
    | { kind: "pan"; startClient: { x: number; y: number }; origPan: { x: number; y: number }; moved: boolean };
  const [interaction, setInteraction] = React.useState<Interaction | null>(null);

  const selectedObj = objects.find((o) => o.id === selectedId) ?? null;

  // Live Inventory Usage (Requirement 2) — "Used" is recomputed from the
  // currently-open plan's own objects on every render, plus a one-time
  // baseline of whatever the booking's *other* floor plans already used at
  // load time (inventoryUsage already includes this plan's load-time count,
  // so it's subtracted back out here to avoid double-counting).
  const liveUsage = React.useMemo(() => {
    if (inventoryUsage.length === 0) return [];
    const initialCountInThisPlan = new Map<string, number>();
    for (const o of initialPlan?.objects ?? []) {
      if (!o.inventoryItemId) continue;
      initialCountInThisPlan.set(o.inventoryItemId, (initialCountInThisPlan.get(o.inventoryItemId) ?? 0) + 1);
    }
    const currentCount = new Map<string, number>();
    for (const o of objects) {
      if (!o.inventoryItemId) continue;
      currentCount.set(o.inventoryItemId, (currentCount.get(o.inventoryItemId) ?? 0) + 1);
    }
    return inventoryUsage.map((u) => {
      const otherPlansUsed = u.quantityUsed - (initialCountInThisPlan.get(u.itemId) ?? 0);
      const used = otherPlansUsed + (currentCount.get(u.itemId) ?? 0);
      return { ...u, quantityUsed: used, remaining: u.quantityAvailable - used };
    });
  }, [inventoryUsage, objects, initialPlan]);

  function snapValue(v: number): number {
    return snapToGrid ? Math.round(v / gridUnit) * gridUnit : v;
  }

  // Convert pointer coords to SVG canvas coords, accounting for current zoom/pan
  function toCanvas(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const viewW = canvasWidth / zoom;
    const viewH = canvasHeight / zoom;
    return {
      x: pan.x + ((clientX - rect.left) / rect.width) * viewW,
      y: pan.y + ((clientY - rect.top) / rect.height) * viewH,
    };
  }

  function clampPan(next: { x: number; y: number }) {
    const viewW = canvasWidth / zoom;
    const viewH = canvasHeight / zoom;
    return {
      x: Math.max(-viewW / 2, Math.min(canvasWidth - viewW / 2, next.x)),
      y: Math.max(-viewH / 2, Math.min(canvasHeight - viewH / 2, next.y)),
    };
  }

  // --- Create floor plan on first use ---
  async function handleCreate() {
    setCreating(true);
    const result = await boundActions.create();
    if (result.ok) {
      window.location.reload();
    } else {
      toast.error(result.message ?? "Could not create floor plan.");
      setCreating(false);
    }
  }

  // --- Pointer events ---
  function handleSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (mode === "add") {
      if (!plan) return;
      const pos = toCanvas(e.clientX, e.clientY);
      const source = addSource!;
      const label = source.fixedLabel
        ?? nextObjectLabel(objects.map((o) => ({ objectType: o.objectType, label: o.label })), source.objectType);
      void (async () => {
        const result = await boundActions.addObject(plan.id, {
          objectType: source.objectType,
          x: snapValue(pos.x), y: snapValue(pos.y),
          label,
          capacity: OBJECT_TYPES[source.objectType].defaultCapacity ?? undefined,
          width: source.width,
          height: source.height,
          color: source.color,
          displayShape: source.displayShape,
          inventoryItemId: source.inventoryItemId,
        });
        if (result.ok && "object" in result) {
          setObjects((prev) => [...prev, result.object]);
          setSelectedId(result.object.id);
          setMode("select");
          setAddSource(null);
        } else if (!result.ok) {
          toast.error(result.message ?? "Could not add object.");
        }
      })();
      return;
    }

    // Select mode, empty canvas: start a potential pan; resolved as a
    // deselect click on pointerup if the pointer never actually moved.
    setInteraction({ kind: "pan", startClient: { x: e.clientX, y: e.clientY }, origPan: pan, moved: false });
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
  }

  function handleObjectPointerDown(e: React.PointerEvent, id: string) {
    if (mode === "add") return;
    setSelectedId(id);
    const obj = objects.find((o) => o.id === id);
    if (!obj || obj.locked) return;
    setInteraction({ kind: "move", id, origPos: { x: obj.x, y: obj.y } });
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
  }

  function handleResizeStart(e: React.PointerEvent, id: string, corner: Corner) {
    const obj = objects.find((o) => o.id === id);
    if (!obj || obj.locked) return;
    setSelectedId(id);
    setInteraction({ kind: "resize", id, corner, center: { x: obj.x, y: obj.y }, rotation: obj.rotation });
  }

  function handleRotateStart(e: React.PointerEvent, id: string) {
    const obj = objects.find((o) => o.id === id);
    if (!obj || obj.locked) return;
    setSelectedId(id);
    setInteraction({ kind: "rotate", id, center: { x: obj.x, y: obj.y } });
  }

  function handleSvgPointerMove(e: React.PointerEvent) {
    if (!interaction) return;
    const pos = toCanvas(e.clientX, e.clientY);

    if (interaction.kind === "pan") {
      const dxClient = e.clientX - interaction.startClient.x;
      const dyClient = e.clientY - interaction.startClient.y;
      if (!interaction.moved && Math.hypot(dxClient, dyClient) < 4) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const viewW = canvasWidth / zoom;
      const viewH = canvasHeight / zoom;
      const canvasDx = (dxClient / rect.width) * viewW;
      const canvasDy = (dyClient / rect.height) * viewH;
      setPan(clampPan({ x: interaction.origPan.x - canvasDx, y: interaction.origPan.y - canvasDy }));
      setInteraction({ ...interaction, moved: true });
      return;
    }

    if (interaction.kind === "move") {
      const newX = Math.max(0, Math.min(canvasWidth, snapValue(pos.x)));
      const newY = Math.max(0, Math.min(canvasHeight, snapValue(pos.y)));
      setObjects((prev) => prev.map((o) => o.id === interaction.id ? { ...o, x: newX, y: newY } : o));
      return;
    }

    if (interaction.kind === "resize") {
      const dx = pos.x - interaction.center.x;
      const dy = pos.y - interaction.center.y;
      const rad = (interaction.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) + dy * Math.sin(rad);
      const localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
      const width = Math.max(MIN_OBJECT_SIZE, snapValue(Math.abs(localX)) * 2);
      const height = Math.max(MIN_OBJECT_SIZE, snapValue(Math.abs(localY)) * 2);
      setObjects((prev) => prev.map((o) => o.id === interaction.id ? { ...o, width, height } : o));
      return;
    }

    if (interaction.kind === "rotate") {
      const dx = pos.x - interaction.center.x;
      const dy = pos.y - interaction.center.y;
      let rotation = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      rotation = ((rotation % 360) + 360) % 360;
      setObjects((prev) => prev.map((o) => o.id === interaction.id ? { ...o, rotation } : o));
    }
  }

  async function handleSvgPointerUp() {
    if (!interaction) return;
    if (interaction.kind === "pan") {
      if (!interaction.moved) setSelectedId(null);
      setInteraction(null);
      return;
    }
    const obj = objects.find((o) => o.id === interaction.id);
    if (obj) {
      if (interaction.kind === "move") void boundActions.updateObject(obj.id, { x: obj.x, y: obj.y });
      else if (interaction.kind === "resize") void boundActions.updateObject(obj.id, { width: obj.width, height: obj.height });
      else if (interaction.kind === "rotate") void boundActions.updateObject(obj.id, { rotation: obj.rotation });
    }
    setInteraction(null);
  }

  // --- Local state update + DB save for properties ---
  function handlePropertyUpdate(id: string, patch: Partial<FloorPlanCanvasObject>) {
    setObjects((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o));
    void boundActions.updateObject(id, patch);
  }

  async function handleDelete(id: string) {
    setObjects((prev) => prev.filter((o) => o.id !== id));
    setSelectedId(null);
    await boundActions.deleteObject(id);
    toast.success("Object deleted.");
  }

  async function handleDuplicate(id: string) {
    if (!plan) return;
    const source = objects.find((o) => o.id === id);
    if (!source) return;
    const result = await boundActions.addObject(plan.id, {
      objectType: source.objectType,
      x: Math.min(canvasWidth, source.x + gridUnit),
      y: Math.min(canvasHeight, source.y + gridUnit),
      label: source.label ?? undefined,
      capacity: source.capacity ?? undefined,
      width: source.width,
      height: source.height,
      rotation: source.rotation,
      color: source.color ?? undefined,
      notes: source.notes ?? undefined,
      displayShape: source.displayShape ?? undefined,
      inventoryItemId: source.inventoryItemId ?? undefined,
    });
    if (result.ok && "object" in result) {
      setObjects((prev) => [...prev, result.object]);
      setSelectedId(result.object.id);
      toast.success("Object duplicated.");
    } else if (!result.ok) {
      toast.error(result.message ?? "Could not duplicate object.");
    }
  }

  async function handleReorder(id: string, direction: "forward" | "backward") {
    if (!plan) return;
    await boundActions.reorderObject(plan.id, id, direction);
    // Sort order changes are cosmetic (render order) — cheapest correct
    // refresh is to re-derive from the server on next load; locally, nudge
    // sortOrder so the current session's render order updates immediately.
    setObjects((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const index = sorted.findIndex((o) => o.id === id);
      const neighborIndex = direction === "forward" ? index + 1 : index - 1;
      if (index === -1 || neighborIndex < 0 || neighborIndex >= sorted.length) return prev;
      const a = sorted[index];
      const b = sorted[neighborIndex];
      return prev.map((o) => {
        if (o.id === a.id) return { ...o, sortOrder: b.sortOrder };
        if (o.id === b.id) return { ...o, sortOrder: a.sortOrder };
        return o;
      });
    });
  }

  // --- Background image upload ---
  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !plan) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${venueId}/${plan.id}/background.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("floor-plans")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("floor-plans").getPublicUrl(path);
      const result = await boundActions.updateBackground(plan.id, publicUrl, plan.backgroundImageOpacity);
      if (result.ok) {
        setPlan((prev) => prev ? { ...prev, backgroundImageUrl: publicUrl } : prev);
        toast.success("Background image updated.");
      }
    } catch (err) {
      toast.error("Upload failed. Check your Supabase Storage configuration.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveBackground() {
    if (!plan) return;
    const result = await boundActions.updateBackground(plan.id, null, 0.25);
    if (result.ok) setPlan((prev) => prev ? { ...prev, backgroundImageUrl: null } : prev);
  }

  async function handleOpacityChange(opacity: number) {
    if (!plan) return;
    setPlan((prev) => prev ? { ...prev, backgroundImageOpacity: opacity } : prev);
    void boundActions.updateBackground(plan.id, plan.backgroundImageUrl, opacity);
  }

  async function handleToggleBackgroundLock() {
    if (!plan) return;
    const locked = !plan.backgroundLocked;
    setPlan((prev) => prev ? { ...prev, backgroundLocked: locked } : prev);
    await boundActions.setBackgroundLocked(plan.id, locked);
  }

  async function handleRoomSizeChange(widthFt: number, depthFt: number) {
    if (!plan) return;
    setPlan((prev) => prev ? { ...prev, roomWidthFt: widthFt, roomDepthFt: depthFt } : prev);
    await boundActions.updateRoomSettings(plan.id, { roomWidthFt: widthFt, roomDepthFt: depthFt, measurementUnit: plan.measurementUnit });
  }

  async function handleUnitChange(unit: MeasurementUnit) {
    if (!plan) return;
    setPlan((prev) => prev ? { ...prev, measurementUnit: unit } : prev);
    await boundActions.updateRoomSettings(plan.id, { roomWidthFt: plan.roomWidthFt, roomDepthFt: plan.roomDepthFt, measurementUnit: unit });
  }

  async function handleClear() {
    if (!plan || !confirm("Remove all objects from the floor plan?")) return;
    await boundActions.clear(plan.id);
    setObjects([]);
    setSelectedId(null);
    toast.success("Floor plan cleared.");
  }

  // --- Keyboard shortcuts ---
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "Escape") {
        setMode("select"); setAddSource(null); setSelectedId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const obj = objects.find((o) => o.id === selectedId);
        if (obj && !obj.locked) void handleDelete(selectedId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, objects]);

  // Empty state (no floor plan yet)
  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="font-heading text-lg font-medium text-heading">No floor plan yet</p>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Create a floor plan to visualize the event layout.
        </p>
        <Button type="button" onClick={handleCreate} disabled={creating}>
          {creating ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating…</> : "Create Floor Plan"}
        </Button>
      </div>
    );
  }

  const cursorClass = mode === "add"
    ? "cursor-crosshair"
    : interaction?.kind === "pan" && interaction.moved ? "cursor-grabbing" : "cursor-default";
  const activeCategory = categoriesWithItems.find((c) => c.id === effectiveActiveCategoryId) ?? null;
  const viewBox = `${pan.x} ${pan.y} ${canvasWidth / zoom} ${canvasHeight / zoom}`;

  return (
    <div className="space-y-4">
      {/* Palette: category chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categoriesWithItems.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategoryId(cat.id)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              effectiveActiveCategoryId === cat.id && !(mode === "add" && addSource?.objectType === "text_label" && !addSource.inventoryItemId)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {cat.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setActiveCategoryId(LABELS_CATEGORY_ID); setMode("add"); setAddSource(TEXT_LABEL_SOURCE); setSelectedId(null); }}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
            effectiveActiveCategoryId === LABELS_CATEGORY_ID
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          Labels
        </button>
        {categoriesWithItems.length === 0 && (
          <Link href="/library/inventory" className="text-xs text-muted-foreground underline hover:text-foreground">
            Set up Inventory to add objects
          </Link>
        )}
      </div>

      {/* Palette: items within the active category */}
      {activeCategory && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-border/70 p-2">
          {activeCategory.items.map((item) => {
            const source = inventoryToAddSource(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { setMode("add"); setAddSource(source); setSelectedId(null); }}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === "add" && addSource?.inventoryItemId === item.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {source.toolbarLabel}
              </button>
            );
          })}
        </div>
      )}

      {mode === "add" && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-heading">
          <span>Click anywhere on the canvas to place a <strong>{addSource!.toolbarLabel}</strong>.</span>
          <button type="button" onClick={() => { setMode("select"); setAddSource(null); }}
            title="Cancel placing object" className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Canvas tools */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => { setMode("select"); setAddSource(null); }}
          className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
            mode === "select" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground")}>
          Select
        </button>

        <Separator orientation="vertical" className="h-6 mx-0.5" />

        <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Number((z - 0.25).toFixed(2))))}
          className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground" title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Number((z + 0.25).toFixed(2))))}
          className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground" title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground" title="Reset view">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        <Separator orientation="vertical" className="h-6 mx-0.5" />

        <button type="button" onClick={() => setShowGrid((v) => !v)}
          className={cn("rounded-lg border p-1.5 transition-colors", showGrid ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground")}
          title="Show/hide grid">
          <Grid3x3 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => setSnapToGrid((v) => !v)}
          className={cn("rounded-lg border p-1.5 transition-colors", snapToGrid ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground")}
          title="Snap to grid">
          <Magnet className="h-3.5 w-3.5" />
        </button>

        <div className="relative">
          <button type="button" onClick={() => setShowRoomSettings((v) => !v)}
            className={cn("rounded-lg border p-1.5 transition-colors", showRoomSettings ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground")}
            title="Room settings">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          {showRoomSettings && (
            <RoomSettingsPanel
              roomWidthFt={plan.roomWidthFt} roomDepthFt={plan.roomDepthFt}
              measurementUnit={plan.measurementUnit} gridIntervalFt={gridIntervalFt}
              onChangeSize={handleRoomSizeChange}
              onChangeUnit={handleUnitChange}
              onChangeGridInterval={setGridIntervalFt}
              onClose={() => setShowRoomSettings(false)}
            />
          )}
        </div>

        <Separator orientation="vertical" className="h-6 mx-0.5" />

        {/* Background image upload — a photo or sketch of the real room, traced
            underneath the layout so placement matches actual walls, doors, and
            fixed features. Not saved as an inventory object; purely a visual guide. */}
        <label
          title="Upload a photo or sketch of the room to trace your layout over — it's a visual guide only, not a Floor Plan object."
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
            (uploading || plan.backgroundLocked) && "opacity-50 pointer-events-none",
          )}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {plan.backgroundImageUrl ? "Change Background Image" : "Add Background Image"}
          <input type="file" accept="image/*" className="sr-only" onChange={handleBackgroundUpload} disabled={plan.backgroundLocked} />
        </label>

        {plan.backgroundImageUrl && (
          <>
            <input type="range" min={0} max={1} step={0.05} value={plan.backgroundImageOpacity}
              onChange={(e) => handleOpacityChange(Number(e.target.value))}
              disabled={plan.backgroundLocked} className="w-20" title="Background image opacity" />
            <button type="button" onClick={handleToggleBackgroundLock}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={plan.backgroundLocked ? "Unlock background image (allow moving/removing it)" : "Lock background image in place"}>
              {plan.backgroundLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </button>
            {!plan.backgroundLocked && (
              <button type="button" onClick={handleRemoveBackground} title="Remove background image"
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}

        <button type="button" onClick={handleClear} title="Remove every object from this Floor Plan"
          className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>

        {showPrint && eventId && (
          <Button type="button" variant="outline" size="sm" className="ml-auto"
            render={<Link href={`/events/${eventId}/floor-plan-print/${plan.id}`} target="_blank" />}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Print
          </Button>
        )}
      </div>

      {/* Canvas + properties */}
      <div className="grid gap-4 xl:grid-cols-[1fr_240px]">
        {/* SVG Canvas */}
        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-background"
          style={{ paddingBottom: `${(canvasHeight / canvasWidth) * 100}%` }}>
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className={cn("absolute inset-0 h-full w-full", cursorClass)}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
          >
            {/* Background */}
            <rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#F7F5F1" />
            {plan.backgroundImageUrl && (
              <image
                href={plan.backgroundImageUrl}
                x={0} y={0} width={canvasWidth} height={canvasHeight}
                opacity={plan.backgroundImageOpacity}
                preserveAspectRatio="xMidYMid meet"
              />
            )}

            {/* Room boundary */}
            <rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="none" stroke="#B8AEA1" strokeWidth={2} />

            {/* Scalable grid — a planning tool, not decoration */}
            {showGrid && Array.from({ length: Math.floor(canvasWidth / gridUnit) }, (_, i) => (i + 1) * gridUnit).map((x) => (
              <line key={`vg-${x}`} x1={x} y1={0} x2={x} y2={canvasHeight} stroke="#DED6CA" strokeWidth={0.5} />
            ))}
            {showGrid && Array.from({ length: Math.floor(canvasHeight / gridUnit) }, (_, i) => (i + 1) * gridUnit).map((y) => (
              <line key={`hg-${y}`} x1={0} y1={y} x2={canvasWidth} y2={y} stroke="#DED6CA" strokeWidth={0.5} />
            ))}

            {/* Objects (sorted by sort_order) */}
            {[...objects].sort((a, b) => a.sortOrder - b.sortOrder).map((obj) => (
              <SvgObject
                key={obj.id}
                obj={obj}
                selected={obj.id === selectedId}
                onPointerDown={handleObjectPointerDown}
                onResizeStart={handleResizeStart}
                onRotateStart={handleRotateStart}
              />
            ))}
          </svg>
        </div>

        {/* Properties */}
        {selectedObj ? (
          <PropertiesPanel
            obj={selectedObj}
            onUpdate={handlePropertyUpdate}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Select an object to edit its properties.
            </p>
          </div>
        )}
      </div>

      {/* Inventory Usage (Requirement 2) — informational only, never blocks placement */}
      {liveUsage.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inventory Usage</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="font-normal pb-1">Inventory Item</th>
                <th className="font-normal pb-1 text-right">Available</th>
                <th className="font-normal pb-1 text-right">Used</th>
                <th className="font-normal pb-1 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {liveUsage.map((u) => {
                const overCommitted = u.remaining < 0;
                return (
                  <tr key={u.itemId} className={overCommitted ? "text-destructive" : "text-foreground"}>
                    <td className="py-0.5">{u.name}</td>
                    <td className="py-0.5 text-right">{u.quantityAvailable}</td>
                    <td className="py-0.5 text-right">{u.quantityUsed}</td>
                    <td className="py-0.5 text-right font-medium">{u.remaining}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {liveUsage.some((u) => u.remaining < 0) && (
            <p className="text-[11px] text-destructive">
              Some items are placed more than the venue has available — informational only, placement isn&apos;t blocked.
            </p>
          )}
        </div>
      )}

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-muted-foreground">
        Room: {formatRoomSize(plan.roomWidthFt, plan.measurementUnit)} × {formatRoomSize(plan.roomDepthFt, plan.measurementUnit)}
        {" · "}Tip: click an object to select, drag to move, use the handles to resize/rotate. Drag empty canvas to pan. Delete/Backspace removes the selection.
      </p>
    </div>
  );
}

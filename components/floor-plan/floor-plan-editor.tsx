"use client";

/**
 * Floor Plan Studio Lite — interactive SVG editor (Sprint 18).
 *
 * Canvas: fixed 800×600 logical units (4:3), rendered via SVG viewBox so it
 * scales perfectly to any container without quality loss.
 *
 * Interactions:
 * - Toolbar: click an object type → mode becomes 'add'
 * - Canvas click in add mode: inserts the object at the clicked position
 * - Object click in select mode: selects the object
 * - Drag selected object: repositions it (saves to DB on mouseup)
 * - Properties panel: edit label, capacity, size; delete object
 * - Background: upload image via Supabase Storage
 */

import * as React from "react";

import Link from "next/link";
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  Printer,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  addObjectAction,
  clearFloorPlanAction,
  createFloorPlanAction,
  deleteObjectAction,
  updateBackgroundAction,
  updateObjectAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/integrations/supabase/client";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  OBJECT_STYLE,
  OBJECT_TYPES,
  nextObjectLabel,
} from "@/lib/floor-plans/constants";
import type {
  FloorPlanObject,
  FloorPlanWithObjects,
  ObjectType,
} from "@/lib/floor-plans/types";
import { cn } from "@/lib/utils";

// ---- SVG object rendering --------------------------------------------------

function SvgObject({
  obj,
  selected,
  onPointerDown,
}: {
  obj: FloorPlanObject;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
}) {
  const meta = OBJECT_TYPES[obj.objectType];
  const style = OBJECT_STYLE[obj.objectType];
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const fontSize = Math.max(9, Math.min(14, obj.width / 6));

  return (
    <g
      transform={`rotate(${obj.rotation}, ${obj.x}, ${obj.y})`}
      className="cursor-pointer"
      onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, obj.id); }}
    >
      {/* Shape */}
      {obj.objectType === "table_round" ? (
        <circle cx={obj.x} cy={obj.y} r={hw}
          fill={style.fill} stroke={style.stroke} strokeWidth={selected ? 2.5 : 1.5} />
      ) : obj.objectType === "table_oval" ? (
        <ellipse cx={obj.x} cy={obj.y} rx={hw} ry={hh}
          fill={style.fill} stroke={style.stroke} strokeWidth={selected ? 2.5 : 1.5} />
      ) : obj.objectType === "text_label" ? (
        null // text-only, rendered below
      ) : (
        <rect x={obj.x - hw} y={obj.y - hh} width={obj.width} height={obj.height} rx={4}
          fill={style.fill} stroke={style.stroke} strokeWidth={selected ? 2.5 : 1.5} />
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

      {/* Selection indicator */}
      {selected && (
        <rect x={obj.x - hw - 4} y={obj.y - hh - 4}
          width={obj.width + 8} height={obj.height + 8} rx={3}
          fill="none" stroke="#5D6F5D" strokeWidth={1.5} strokeDasharray="5,3" />
      )}
    </g>
  );
}

// ---- Toolbar ----------------------------------------------------------------

const TOOLBAR_ITEMS: { type: ObjectType; label: string }[] = [
  { type: "table_round", label: "⬤ Round" },
  { type: "table_rect",  label: "▬ Rect"  },
  { type: "table_oval",  label: "◉ Oval"  },
  { type: "stage",       label: "▭ Stage" },
  { type: "dance_floor", label: "◻ Dance" },
  { type: "bar",         label: "▭ Bar"   },
  { type: "gift_table",  label: "▭ Gifts" },
  { type: "cake_table",  label: "▭ Cake"  },
  { type: "text_label",  label: "T Label" },
];

// ---- Properties panel -------------------------------------------------------

function PropertiesPanel({
  obj,
  onUpdate,
  onDelete,
}: {
  obj: FloorPlanObject;
  onUpdate: (id: string, patch: Partial<FloorPlanObject>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3 p-3 border border-border bg-card rounded-xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {OBJECT_TYPES[obj.objectType].label}
      </p>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={obj.label ?? ""}
            onChange={(e) => onUpdate(obj.id, { label: e.target.value })}
            className="h-7 text-xs"
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
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Width</Label>
            <Input
              type="number"
              value={Math.round(obj.width)}
              onChange={(e) => onUpdate(obj.id, { width: Math.max(20, Number(e.target.value)) })}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height</Label>
            <Input
              type="number"
              value={Math.round(obj.height)}
              onChange={(e) => onUpdate(obj.id, { height: Math.max(20, Number(e.target.value)) })}
              className="h-7 text-xs"
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
          />
        </div>
      </div>
      <Button
        type="button" variant="destructive" size="sm" className="w-full"
        onClick={() => onDelete(obj.id)}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  );
}

// ---- Main editor ------------------------------------------------------------

export function FloorPlanEditor({
  initialPlan,
  eventId,
  eventName,
  venueId,
}: {
  initialPlan: FloorPlanWithObjects | null;
  eventId: string;
  eventName: string;
  venueId: string;
}) {
  const [plan, setPlan] = React.useState<FloorPlanWithObjects | null>(initialPlan);
  const [objects, setObjects] = React.useState<FloorPlanObject[]>(initialPlan?.objects ?? []);
  const [mode, setMode] = React.useState<"select" | "add">("select");
  const [addType, setAddType] = React.useState<ObjectType | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState<{
    id: string; startPx: { x: number; y: number }; origPos: { x: number; y: number };
  } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const selectedObj = objects.find((o) => o.id === selectedId) ?? null;

  // Convert pointer coords to SVG canvas coords
  function toCanvas(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  // --- Create floor plan on first use ---
  async function handleCreate() {
    setCreating(true);
    const result = await createFloorPlanAction(eventId);
    if (result.ok) {
      // Reload will happen via revalidatePath
      window.location.reload();
    } else {
      toast.error(result.message ?? "Could not create floor plan.");
      setCreating(false);
    }
  }

  // --- Pointer events for dragging / adding ---
  function handleSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== "add") {
      setSelectedId(null);
      return;
    }
    // Add mode: insert object at click position
    if (!plan) return;
    const pos = toCanvas(e.clientX, e.clientY);
    const type = addType!;
    const meta = OBJECT_TYPES[type];
    const label = nextObjectLabel(objects.map((o) => ({ objectType: o.objectType, label: o.label })), type);
    void (async () => {
      const result = await addObjectAction(plan.id, eventId, {
        objectType: type,
        x: pos.x,
        y: pos.y,
        label,
        capacity: meta.defaultCapacity ?? undefined,
      });
      if (result.ok && "object" in result) {
        setObjects((prev) => [...prev, result.object]);
        setSelectedId(result.object.id);
        setMode("select");
        setAddType(null);
      } else if (!result.ok) {
        toast.error(result.message ?? "Could not add object.");
      }
    })();
  }

  function handleObjectPointerDown(e: React.PointerEvent, id: string) {
    if (mode === "add") return;
    setSelectedId(id);
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    const pos = toCanvas(e.clientX, e.clientY);
    setDragging({ id, startPx: pos, origPos: { x: obj.x, y: obj.y } });
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
  }

  function handleSvgPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const pos = toCanvas(e.clientX, e.clientY);
    const dx = pos.x - dragging.startPx.x;
    const dy = pos.y - dragging.startPx.y;
    const newX = Math.max(0, Math.min(CANVAS_WIDTH, dragging.origPos.x + dx));
    const newY = Math.max(0, Math.min(CANVAS_HEIGHT, dragging.origPos.y + dy));
    setObjects((prev) => prev.map((o) => o.id === dragging.id ? { ...o, x: newX, y: newY } : o));
  }

  async function handleSvgPointerUp() {
    if (!dragging) return;
    const obj = objects.find((o) => o.id === dragging.id);
    if (obj) {
      void updateObjectAction(obj.id, { x: obj.x, y: obj.y });
    }
    setDragging(null);
  }

  // --- Local state update + DB save for properties ---
  function handlePropertyUpdate(id: string, patch: Partial<FloorPlanObject>) {
    setObjects((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o));
    void updateObjectAction(id, patch as Parameters<typeof updateObjectAction>[1]);
  }

  async function handleDelete(id: string) {
    setObjects((prev) => prev.filter((o) => o.id !== id));
    setSelectedId(null);
    await deleteObjectAction(id, eventId);
    toast.success("Object deleted.");
  }

  // --- Background image upload ---
  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !plan) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${venueId}/${eventId}/background.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("floor-plans")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("floor-plans").getPublicUrl(path);
      const result = await updateBackgroundAction(plan.id, eventId, publicUrl, plan.backgroundImageOpacity);
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
    const result = await updateBackgroundAction(plan.id, eventId, null, 0.25);
    if (result.ok) setPlan((prev) => prev ? { ...prev, backgroundImageUrl: null } : prev);
  }

  async function handleClear() {
    if (!plan || !confirm("Remove all objects from the floor plan?")) return;
    await clearFloorPlanAction(plan.id, eventId);
    setObjects([]);
    setSelectedId(null);
    toast.success("Floor plan cleared.");
  }

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
    : dragging ? "cursor-grabbing" : "cursor-default";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLBAR_ITEMS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => { setMode("add"); setAddType(type); setSelectedId(null); }}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "add" && addType === type
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Background upload */}
        <label className={cn(
          "flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
          uploading && "opacity-50 pointer-events-none",
        )}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {plan.backgroundImageUrl ? "Change BG" : "Set BG"}
          <input type="file" accept="image/*" className="sr-only" onChange={handleBackgroundUpload} />
        </label>

        {plan.backgroundImageUrl && (
          <button type="button" onClick={handleRemoveBackground}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        <button type="button" onClick={handleClear}
          className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>

        <Button type="button" variant="outline" size="sm" className="ml-auto"
          render={<Link href={`/events/${eventId}/floor-plan-print`} target="_blank" />}>
          <Printer className="mr-1 h-3.5 w-3.5" /> Print
        </Button>
      </div>

      {mode === "add" && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-heading">
          <span>Click anywhere on the canvas to place a <strong>{OBJECT_TYPES[addType!].label}</strong>.</span>
          <button type="button" onClick={() => { setMode("select"); setAddType(null); }}
            className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Canvas + properties */}
      <div className="grid gap-4 xl:grid-cols-[1fr_220px]">
        {/* SVG Canvas */}
        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-background"
          style={{ paddingBottom: `${(CANVAS_HEIGHT / CANVAS_WIDTH) * 100}%` }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className={cn("absolute inset-0 h-full w-full", cursorClass)}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
          >
            {/* Background */}
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#F7F5F1" />
            {plan.backgroundImageUrl && (
              <image
                href={plan.backgroundImageUrl}
                x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
                opacity={plan.backgroundImageOpacity}
                preserveAspectRatio="xMidYMid meet"
              />
            )}

            {/* Grid lines (subtle) */}
            {Array.from({ length: 8 }, (_, i) => (i + 1) * 100).map((x) => (
              <line key={`vg-${x}`} x1={x} y1={0} x2={x} y2={CANVAS_HEIGHT}
                stroke="#DED6CA" strokeWidth={0.5} />
            ))}
            {Array.from({ length: 5 }, (_, i) => (i + 1) * 100).map((y) => (
              <line key={`hg-${y}`} x1={0} y1={y} x2={CANVAS_WIDTH} y2={y}
                stroke="#DED6CA" strokeWidth={0.5} />
            ))}

            {/* Objects (sorted by sort_order) */}
            {[...objects].sort((a, b) => a.sortOrder - b.sortOrder).map((obj) => (
              <SvgObject
                key={obj.id}
                obj={obj}
                selected={obj.id === selectedId}
                onPointerDown={handleObjectPointerDown}
              />
            ))}
          </svg>
        </div>

        {/* Properties */}
        {selectedObj ? (
          <PropertiesPanel
            obj={selectedObj}
            onUpdate={handlePropertyUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Select an object to edit its properties.
            </p>
          </div>
        )}
      </div>

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-muted-foreground">
        Tip: click an object to select, then drag to reposition.
      </p>
    </div>
  );
}

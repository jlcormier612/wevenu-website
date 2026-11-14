"use client";

/**
 * Couple Floor Plan section:
 * - Zero offers / no shared plans → waiting state
 * - One offer → venue seeds working layout (auto-shared)
 * - Multiple offers → selection establishes working layout (no preference approval)
 * - Move unlocked furniture / add tables only when permitted (server-enforced)
 * - Furniture submit/review is separate from layout selection
 */

import * as React from "react";

import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { FloorPlanSubmitConfirmDialog } from "@/components/portal/floor-plan-submit-confirm-dialog";
import { OBJECT_STYLE } from "@/lib/floor-plans/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  floorPlanCapacityNeedsAttention,
  formatFloorPlanCapacityCompact,
  formatFloorPlanCapacitySentence,
  summarizeFloorPlanCapacity,
} from "@/lib/floor-plans/capacity";
import {
  clientLayoutStatusLabel,
  clientMayEditLayout,
  clientMaySubmitLayout,
  normalizeClientLayoutStatus,
} from "@/lib/floor-plans/client-layout-review";
import {
  portalFloorPlanEditingHelpItems,
  portalFloorPlanGuidance,
} from "@/lib/floor-plans/portal-guidance";
import type { DisplayShape, ObjectType } from "@/lib/floor-plans/types";
import { resolveDisplayShape } from "@/lib/floor-plans/resolve-display-shape";
import type {
  PortalFloorPlanCatalogItem,
  PortalFloorPlanDetail,
  PortalFloorPlanFurnitureCatalog,
  PortalFloorPlanObject,
  PortalFloorPlanOfferSummary,
  PortalFloorPlanSummary,
} from "@/lib/portal/types";
import { catalogLimitLabel, isLimitReason } from "@/lib/portal/floor-plan-catalog-limit";

const SAGE = "#5F8A5B";
const SEATABLE = new Set(["table_round", "table_rect", "table_oval"]);

function formatInches(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return null;
  return `${Math.round(Number(n))}"`;
}

function catalogDimsLabel(item: PortalFloorPlanCatalogItem): string {
  const w = formatInches(item.placeWidth ?? item.width);
  const h = formatInches(item.placeHeight ?? item.length);
  if (w && h) return `${w} × ${h}`;
  if (w) return w;
  return "Dimensions not set";
}

function renderObjectStatic(obj: PortalFloorPlanObject): React.ReactNode {
  const legacyStyle = OBJECT_STYLE[obj.objectType as ObjectType] ?? OBJECT_STYLE.other;
  const shape = resolveDisplayShape({
    displayShape: obj.displayShape,
    objectType: obj.objectType,
    width: obj.width,
    height: obj.height,
    label: obj.label,
  });
  const style = DISPLAY_SHAPE_STYLE[shape] ?? legacyStyle;
  const fill = obj.color ?? style.fill;
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const fontSize = Math.max(9, Math.min(13, obj.width / 6));
  const transform = `rotate(${obj.rotation}, ${obj.x}, ${obj.y})`;
  const showCapacity = SEATABLE.has(obj.objectType) && obj.capacity != null && obj.capacity > 0;

  return (
    <g key={obj.id} transform={transform}>
      {obj.objectType === "text_label" ? null : (
        <FloorPlanShapeSvg
          shape={shape} x={obj.x} y={obj.y} width={obj.width} height={obj.height}
          fill={fill} stroke={style.stroke} strokeWidth={1.5}
        />
      )}
      {obj.objectType !== "text_label" && obj.label ? (
        <text x={obj.x} y={showCapacity ? obj.y - 5 : obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fill={style.textFill} fontFamily="sans-serif">
          {obj.label}
        </text>
      ) : null}
      {showCapacity ? (
        <text x={obj.x} y={obj.label ? obj.y + 9 : obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={Math.max(8, fontSize - 2)} fill={style.textFill} fontFamily="sans-serif" opacity={0.85}>
          {obj.capacity} seats
        </text>
      ) : null}
      {obj.objectType === "text_label" && (
        <text x={obj.x} y={obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fill={style.textFill} fontFamily="sans-serif" fontWeight="500">
          {obj.label ?? "Label"}
        </text>
      )}
      {obj.locked ? (
        <circle cx={obj.x + hw - 6} cy={obj.y - hh + 6} r={5} fill="#64748b" opacity={0.85} />
      ) : null}
    </g>
  );
}

function LayoutPreviewSvg({
  planName,
  roomWidthFt,
  roomDepthFt,
  backgroundImageUrl,
  backgroundImageOpacity,
  objects,
}: {
  planName: string;
  roomWidthFt: number;
  roomDepthFt: number;
  backgroundImageUrl?: string | null;
  backgroundImageOpacity?: number;
  objects: PortalFloorPlanObject[];
}) {
  const roomW = Number(roomWidthFt) * 12 || 800;
  const roomH = Number(roomDepthFt) * 12 || 600;
  let maxX = roomW;
  let maxY = roomH;
  for (const obj of objects) {
    const hw = Number(obj.width) / 2 || 0;
    const hh = Number(obj.height) / 2 || 0;
    maxX = Math.max(maxX, Number(obj.x) + hw);
    maxY = Math.max(maxY, Number(obj.y) + hh);
  }
  const canvasW = Math.ceil(maxX);
  const canvasH = Math.ceil(maxY);
  return (
    <div className="overflow-auto bg-[#F7F5F1] p-3">
      <svg
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        className="w-full h-auto max-h-[50vh] mx-auto block"
        role="img"
        aria-label={`Layout preview: ${planName}`}
      >
        <rect x={0} y={0} width={canvasW} height={canvasH} fill="#F7F5F1" />
        {backgroundImageUrl && (
          <image
            href={backgroundImageUrl}
            x={0} y={0} width={canvasW} height={canvasH}
            opacity={Number(backgroundImageOpacity ?? 0.25)}
            preserveAspectRatio="xMidYMid slice"
          />
        )}
        {objects.map(renderObjectStatic)}
      </svg>
    </div>
  );
}

/** Interactive working canvas — drag unlocked objects; locked items show a lock cue. */
function WorkingLayoutCanvas({
  token,
  planName,
  roomWidthFt,
  roomDepthFt,
  backgroundImageUrl,
  backgroundImageOpacity,
  objects,
  editable,
  onObjectsChange,
}: {
  token: string;
  planName: string;
  roomWidthFt: number;
  roomDepthFt: number;
  backgroundImageUrl?: string | null;
  backgroundImageOpacity?: number;
  objects: PortalFloorPlanObject[];
  editable: boolean;
  onObjectsChange: (next: PortalFloorPlanObject[]) => void;
}) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [localObjects, setLocalObjects] = React.useState(objects);
  const [moveError, setMoveError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState(false);
  const roomConfigured = Number(roomWidthFt) > 0 && Number(roomDepthFt) > 0;
  const roomW = roomConfigured ? Number(roomWidthFt) * 12 : 800;
  const roomH = roomConfigured ? Number(roomDepthFt) * 12 : 600;
  const dragRef = React.useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    scaleX: number;
    scaleY: number;
    lastX: number;
    lastY: number;
    halfW: number;
    halfH: number;
  } | null>(null);

  React.useEffect(() => {
    setLocalObjects(objects);
  }, [objects]);

  function clampToRoom(x: number, y: number, halfW: number, halfH: number) {
    if (!roomConfigured) return { x, y };
    return {
      x: Math.min(roomW - halfW, Math.max(halfW, x)),
      y: Math.min(roomH - halfH, Math.max(halfH, y)),
    };
  }

  function clientToSvgScale(svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      scaleX: vb.width / Math.max(rect.width, 1),
      scaleY: vb.height / Math.max(rect.height, 1),
    };
  }

  function onPointerDown(e: React.PointerEvent, obj: PortalFloorPlanObject) {
    setSelectedId(obj.id);
    if (!editable || obj.locked) {
      if (obj.locked) setMoveError("This element is locked by your venue and cannot be moved.");
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const { scaleX, scaleY } = clientToSvgScale(svg);
    dragRef.current = {
      id: obj.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: Number(obj.x),
      originY: Number(obj.y),
      scaleX,
      scaleY,
      lastX: Number(obj.x),
      lastY: Number(obj.y),
      halfW: Number(obj.width) / 2 || 0,
      halfH: Number(obj.height) / 2 || 0,
    };
    setMoveError(null);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startClientX) * drag.scaleX;
    const dy = (e.clientY - drag.startClientY) * drag.scaleY;
    const clamped = clampToRoom(drag.originX + dx, drag.originY + dy, drag.halfW, drag.halfH);
    drag.lastX = clamped.x;
    drag.lastY = clamped.y;
    setLocalObjects((prev) =>
      prev.map((o) => (o.id === drag.id ? { ...o, x: clamped.x, y: clamped.y } : o)),
    );
  }

  async function onPointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const x = drag.lastX;
    const y = drag.lastY;
    if (Math.abs(x - drag.originX) < 0.5 && Math.abs(y - drag.originY) < 0.5) return;
    try {
      const r = await fetch("/api/portal/floor-plans/move-object", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, objectId: drag.id, x, y }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        const code = d.error ?? "move_failed";
        setMoveError(
          code === "object_locked" ? "This element is locked by your venue."
            : code === "plan_ready" ? "This layout is Ready — ask your venue to Make Changes if you need edits."
              : code === "outside_room" ? "That placement is outside the room boundary."
                : "Could not save the move.",
        );
        setLocalObjects(objects);
        return;
      }
      const next = localObjects.map((o) => (o.id === drag.id ? { ...o, x, y } : o));
      setLocalObjects(next);
      onObjectsChange(next);
    } catch {
      setMoveError("Could not save the move.");
      setLocalObjects(objects);
    }
  }

  async function removeSelected(confirmUnassign = false) {
    if (!selectedId || !editable) return;
    const obj = localObjects.find((o) => o.id === selectedId);
    if (!obj || obj.locked || !SEATABLE.has(obj.objectType)) return;
    setRemoving(true);
    setMoveError(null);
    try {
      const r = await fetch("/api/portal/floor-plans/remove-object", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, objectId: selectedId, confirmUnassign }),
      });
      const d = await r.json() as { ok?: boolean; error?: string; assignedCount?: number };
      if (d.error === "has_assignments") {
        const n = d.assignedCount ?? 0;
        const ok = window.confirm(
          `This table has ${n} guest${n === 1 ? "" : "s"} assigned. Remove it and return those guests to Unassigned?`,
        );
        if (ok) {
          await removeSelected(true);
        }
        return;
      }
      if (!r.ok || !d.ok) {
        setMoveError(
          d.error === "object_locked" ? "This element is locked by your venue."
            : d.error === "plan_ready" ? "This layout is Ready — ask your venue to Make Changes if you need edits."
              : d.error === "type_not_removable" ? "Only seating tables can be removed here."
                : "Could not remove this element.",
        );
        return;
      }
      const next = localObjects.filter((o) => o.id !== selectedId);
      setLocalObjects(next);
      onObjectsChange(next);
      setSelectedId(null);
    } catch {
      setMoveError("Could not remove this element.");
    } finally {
      setRemoving(false);
    }
  }

  let maxX = roomW;
  let maxY = roomH;
  for (const obj of localObjects) {
    const hw = Number(obj.width) / 2 || 0;
    const hh = Number(obj.height) / 2 || 0;
    maxX = Math.max(maxX, Number(obj.x) + hw);
    maxY = Math.max(maxY, Number(obj.y) + hh);
  }
  const canvasW = Math.ceil(maxX);
  const canvasH = Math.ceil(maxY);
  const selected = localObjects.find((o) => o.id === selectedId) ?? null;
  const canRemove = Boolean(
    editable && selected && !selected.locked && SEATABLE.has(selected.objectType),
  );

  return (
    <div className="space-y-2">
      <div
        className="overflow-auto bg-[#F7F5F1] p-3 min-h-[min(340px,55vh)] max-h-[min(70vh,720px)] md:min-h-[420px] md:max-h-[75vh]"
        data-testid="floor-plan-working-canvas"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          className="w-full h-auto mx-auto block touch-none"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Your floor plan: ${planName}`}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <rect x={0} y={0} width={canvasW} height={canvasH} fill="#F7F5F1" />
          {roomConfigured && (
            <rect
              x={0} y={0} width={roomW} height={roomH}
              fill="none" stroke="#8A7F72" strokeWidth={2} strokeDasharray="8 6"
              data-testid="floor-plan-room-boundary"
            />
          )}
          {backgroundImageUrl && (
            <image
              href={backgroundImageUrl}
              x={0} y={0} width={roomConfigured ? roomW : canvasW} height={roomConfigured ? roomH : canvasH}
              opacity={Number(backgroundImageOpacity ?? 0.25)}
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          {localObjects.map((obj) => {
            const locked = Boolean(obj.locked);
            const canDrag = editable && !locked;
            const isSelected = obj.id === selectedId;
            return (
              <g
                key={obj.id}
                style={{ cursor: canDrag ? "grab" : locked ? "not-allowed" : "default" }}
                onPointerDown={(e) => onPointerDown(e, obj)}
                data-testid={locked ? "floor-plan-object-locked" : "floor-plan-object-movable"}
                data-object-id={obj.id}
                data-object-type={obj.objectType}
                data-capacity={obj.capacity ?? ""}
              >
                {isSelected ? (
                  <rect
                    x={obj.x - obj.width / 2 - 4}
                    y={obj.y - obj.height / 2 - 4}
                    width={obj.width + 8}
                    height={obj.height + 8}
                    fill="none"
                    stroke={SAGE}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    rx={4}
                  />
                ) : null}
                {renderObjectStatic(obj)}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="px-1 flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[11px] text-muted-foreground" data-testid="floor-plan-room-scale">
          {roomConfigured
            ? `Room ${Number(roomWidthFt)} × ${Number(roomDepthFt)} ft · canvas 1 unit = 1 inch`
            : "Room dimensions not set by venue — layout uses canvas scale (not claimed as feet)."}
        </p>
        {canRemove && (
          <button
            type="button"
            disabled={removing}
            onClick={() => void removeSelected(false)}
            className="text-[11px] font-semibold text-destructive disabled:opacity-50"
            data-testid="floor-plan-remove-table"
          >
            {removing ? "Removing…" : "Remove selected table"}
          </button>
        )}
      </div>
      {selected && (
        <p className="text-[11px] text-muted-foreground px-1" data-testid="floor-plan-selected-meta">
          {selected.label ?? selected.objectType}
          {selected.capacity != null ? ` · ${selected.capacity} seats` : ""}
          {formatInches(selected.width) && formatInches(selected.height)
            ? ` · ${formatInches(selected.width)} × ${formatInches(selected.height)}`
            : ""}
          {selected.locked ? " · Locked by venue" : ""}
        </p>
      )}
      {moveError && (
        <p className="text-xs text-destructive px-1" data-testid="floor-plan-move-error">{moveError}</p>
      )}
    </div>
  );
}

type PortalSetupPackage = {
  setupId: string;
  name: string;
  sortOrder: number;
  coupleSelectedFloorPlanId: string | null;
  couplePreferenceStatus: string | null;
  coupleApprovedFloorPlanId: string | null;
  operationalFloorPlanId: string | null;
  layouts: Array<{
    floorPlanId: string;
    name: string;
    sortOrder: number;
    sharedWithCouple: boolean;
    isPreference: boolean;
    isApproved: boolean;
    isWorking: boolean;
  }>;
};

/** Phase 3 — “Your wedding setups” package view (FP-S6). */
function WeddingSetupsSection({
  token,
  setups,
  onSelected,
}: {
  token: string;
  setups: PortalSetupPackage[];
  onSelected: () => void;
}) {
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function choose(setupId: string, floorPlanId: string) {
    setPendingKey(`${setupId}:${floorPlanId}`);
    setError(null);
    try {
      const r = await fetch("/api/portal/floor-plan-setups/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, setupId, floorPlanId }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setError(d.error ?? "Could not select this layout for the setup.");
        return;
      }
      onSelected();
    } catch {
      setError("Could not select this layout. Nothing was changed — you can try again.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="space-y-4" data-testid="floor-plan-wedding-setups">
      <div>
        <h2 className="text-lg font-semibold text-heading">Your wedding setups</h2>
        <p className="text-xs text-muted-foreground mt-0.5" data-testid="floor-plan-wedding-setups-copy">
          Choose one starting layout for each part of your day (for example ceremony, cocktail, and
          reception). Alternatives appear only under the setup they belong to. Your selection becomes the
          working layout for that setup — no extra venue approval step for the choice itself.
        </p>
      </div>
      {setups.map((setup) => {
        const status = setup.couplePreferenceStatus ?? null;
        const proposed = status === "proposed_replacement";
        const applied = status === "applied" || status === "approved";
        return (
          <div
            key={setup.setupId}
            className="rounded-xl border border-border bg-background p-4 space-y-3"
            data-testid={`floor-plan-wedding-setup-${setup.setupId}`}
          >
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Required setup
              </p>
              <p className="text-sm font-semibold text-heading">{setup.name}</p>
              {proposed ? (
                <p className="text-xs text-amber-800 mt-1">
                  Layout change requested for this setup — waiting on your venue. Current working layout stays until they accept.
                </p>
              ) : null}
              {applied && setup.coupleSelectedFloorPlanId && !proposed ? (
                <p className="text-xs text-muted-foreground mt-1">Your selection is the working layout for this setup.</p>
              ) : null}
            </div>
            {setup.layouts.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid={`floor-plan-setup-empty-${setup.setupId}`}>
                Your venue has not shared a layout for this setup yet.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {setup.layouts.map((layout) => {
                  const selected = layout.isPreference;
                  const busy = pendingKey === `${setup.setupId}:${layout.floorPlanId}`;
                  return (
                    <li key={layout.floorPlanId}>
                      <button
                        type="button"
                        disabled={busy}
                        data-testid={`floor-plan-setup-option-${setup.setupId}-${layout.floorPlanId}`}
                        className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                          selected
                            ? "border-heading bg-muted/40"
                            : "border-border hover:border-heading/40"
                        }`}
                        onClick={() => void choose(setup.setupId, layout.floorPlanId)}
                      >
                        <span className="font-medium text-heading">{layout.name}</span>
                        <span className="mt-1 block text-[0.7rem] text-muted-foreground">
                          {selected ? "Your selection · " : ""}
                          {layout.isWorking
                            ? "Working layout for this setup"
                            : proposed && selected
                              ? "Proposed replacement"
                              : setup.layouts.length > 1
                                ? "Alternative for this setup"
                                : "Layout for this setup"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      {error ? (
        <p className="text-sm text-destructive" data-testid="floor-plan-wedding-setups-error">{error}</p>
      ) : null}
    </section>
  );
}

function ChooseLayoutSection({
  token,
  offers,
  onSelected,
}: {
  token: string;
  offers: PortalFloorPlanOfferSummary[];
  onSelected: () => void;
}) {
  const [previewOfferId, setPreviewOfferId] = React.useState<string | null>(
    () => offers.find((o) => o.isCurrentSelection)?.offerId ?? offers[0]?.offerId ?? null,
  );
  const [preview, setPreview] = React.useState<{
    name: string;
    roomWidthFt: number;
    roomDepthFt: number;
    backgroundImageUrl: string | null;
    backgroundImageOpacity: number;
    objects: PortalFloorPlanObject[];
  } | null>(null);
  const [selecting, setSelecting] = React.useState(false);
  const [selectError, setSelectError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!previewOfferId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/portal/floor-plan-offers/${previewOfferId}?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json() as {
          plan?: {
            name: string;
            roomWidthFt: number;
            roomDepthFt: number;
            backgroundImageUrl: string | null;
            backgroundImageOpacity: number;
          };
          objects?: PortalFloorPlanObject[];
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok || d.error || !d.plan) {
          setPreview(null);
          return;
        }
        setPreview({
          name: d.plan.name,
          roomWidthFt: Number(d.plan.roomWidthFt),
          roomDepthFt: Number(d.plan.roomDepthFt),
          backgroundImageUrl: d.plan.backgroundImageUrl,
          backgroundImageOpacity: Number(d.plan.backgroundImageOpacity ?? 0.25),
          objects: d.objects ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => { cancelled = true; };
  }, [token, previewOfferId]);

  async function choose(offerId: string) {
    setSelecting(true);
    setSelectError(null);
    try {
      const r = await fetch("/api/portal/floor-plan-offers/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, offerId }),
      });
      const d = await r.json() as { ok?: boolean; error?: string; preferenceStatus?: string; mode?: string };
      if (!r.ok || !d.ok) {
        setSelectError(d.error ?? "Could not select this layout.");
        return;
      }
      onSelected();
    } catch {
      setSelectError("Could not select this layout. Nothing was changed — you can try again.");
    } finally {
      setSelecting(false);
    }
  }

  const active = offers.find((o) => o.offerId === previewOfferId) ?? null;

  return (
    <section className="space-y-3" data-testid="floor-plan-choose-layout">
      <div>
        <h2 className="text-lg font-semibold text-heading">Choose your starting layout</h2>
        <p className="text-xs text-muted-foreground mt-0.5" data-testid="floor-plan-choose-preference-copy">
          Your venue has prepared a few options for your celebration. Select the one that works best for you —
          that becomes your working layout. You do not need an extra approval step for this choice.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {offers.map((o) => {
          const selected = o.offerId === previewOfferId;
          return (
            <button
              key={o.offerId}
              type="button"
              onClick={() => setPreviewOfferId(o.offerId)}
              className={`text-left rounded-xl border px-3 py-3 transition-colors ${
                o.isCurrentSelection
                  ? "border-[color-mix(in_srgb,var(--venue-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--venue-primary)_8%,transparent)]"
                  : selected
                    ? "border-border bg-card ring-1 ring-[color-mix(in_srgb,var(--venue-primary)_35%,transparent)]"
                    : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-heading">{o.name}</p>
                {o.isCurrentSelection && (
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${SAGE}18`, color: SAGE }}>
                    Your choice
                  </span>
                )}
              </div>
              {o.blurb?.trim() && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{o.blurb}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {o.objectCount} element{o.objectCount === 1 ? "" : "s"}
              </p>
            </button>
          );
        })}
      </div>

      {preview && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-heading">{preview.name}</p>
              <p className="text-[11px] text-muted-foreground">Preview</p>
            </div>
            <button
              type="button"
              disabled={selecting || active?.isCurrentSelection}
              onClick={() => active && choose(active.offerId)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl text-white disabled:opacity-50"
              style={{ background: SAGE }}
            >
              {active?.isCurrentSelection
                ? "Current layout"
                : selecting
                  ? "Selecting…"
                  : "Use this layout"}
            </button>
          </div>
          <LayoutPreviewSvg
            planName={preview.name}
            roomWidthFt={preview.roomWidthFt}
            roomDepthFt={preview.roomDepthFt}
            backgroundImageUrl={preview.backgroundImageUrl}
            backgroundImageOpacity={preview.backgroundImageOpacity}
            objects={preview.objects}
          />
        </div>
      )}

      {selectError && <p className="text-xs text-destructive">{selectError}</p>}
    </section>
  );
}

export default function FloorPlanSection({
  token,
  guestCount: guestCountProp = null,
}: {
  token: string;
  /** Optional fallback from portal context when detail payload omits it. */
  guestCount?: number | null;
}) {
  const [list, setList] = React.useState<PortalFloorPlanSummary[]>([]);
  const [offers, setOffers] = React.useState<PortalFloorPlanOfferSummary[]>([]);
  const [setups, setSetups] = React.useState<PortalSetupPackage[]>([]);
  const [hasSetups, setHasSetups] = React.useState(false);
  const [operationalId, setOperationalId] = React.useState<string | null>(null);
  const [coupleSelectedIdFromApi, setCoupleSelectedIdFromApi] = React.useState<string | null>(null);
  const [preferenceStatus, setPreferenceStatus] = React.useState<string | null>(null);
  const [, setApprovedId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PortalFloorPlanDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadTick, setReloadTick] = React.useState(0);
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [capacityDetailsOpen, setCapacityDetailsOpen] = React.useState(false);
  const [requestLayoutOpen, setRequestLayoutOpen] = React.useState(false);
  const [requestSelecting, setRequestSelecting] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  const [catalog, setCatalog] = React.useState<PortalFloorPlanFurnitureCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitOk, setSubmitOk] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        await fetch("/api/portal/floor-plans/ensure-assignment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        }).catch(() => null);

        const [plansRes, offersRes, setupsRes] = await Promise.all([
          fetch(`/api/portal/floor-plans?token=${encodeURIComponent(token)}`).then(async (r) => ({
            ok: r.ok,
            body: await r.json() as {
              floorPlans?: PortalFloorPlanSummary[];
              operationalFloorPlanId?: string | null;
              coupleSelectedFloorPlanId?: string | null;
              couplePreferenceStatus?: string | null;
              coupleApprovedFloorPlanId?: string | null;
              error?: string;
            },
          })),
          fetch(`/api/portal/floor-plan-offers?token=${encodeURIComponent(token)}`).then(async (r) => ({
            ok: r.ok,
            body: await r.json() as {
              offers?: PortalFloorPlanOfferSummary[];
              error?: string;
            },
          })),
          fetch(`/api/portal/floor-plan-setups?token=${encodeURIComponent(token)}`).then(async (r) => ({
            ok: r.ok,
            body: await r.json() as {
              setups?: PortalSetupPackage[];
              hasSetups?: boolean;
              error?: string;
            },
          })).catch(() => ({
            ok: false,
            body: {
              setups: [] as PortalSetupPackage[],
              hasSetups: false,
              error: "unavailable",
            },
          })),
        ]);

        if (cancelled) return;

        if (!plansRes.ok || plansRes.body.error) {
          setError(plansRes.body.error ?? "Could not load Floor Plan.");
          setList([]);
        } else {
          const plans = plansRes.body.floorPlans ?? [];
          setList(plans);
          setOperationalId(plansRes.body.operationalFloorPlanId ?? null);
          const coupleSelected = plansRes.body.coupleSelectedFloorPlanId ?? null;
          setCoupleSelectedIdFromApi(coupleSelected);
          const prefStatus = plansRes.body.couplePreferenceStatus ?? null;
          setPreferenceStatus(prefStatus);
          setApprovedId(plansRes.body.coupleApprovedFloorPlanId ?? null);
          // Pending replacement: keep showing the operational Ready layout.
          // The couple-selected pointer is the requested layout — never open it
          // as an editable working canvas while the venue decides.
          const operationalPtr = plansRes.body.operationalFloorPlanId
            && plans.find((p) => p.id === plansRes.body.operationalFloorPlanId)?.id;
          const couplePtr = coupleSelected && plans.find((p) => p.id === coupleSelected)?.id;
          const preferred = prefStatus === "proposed_replacement"
            ? (operationalPtr ?? couplePtr ?? plans[0]?.id ?? null)
            : (couplePtr ?? operationalPtr ?? plans[0]?.id ?? null);
          setSelectedId(preferred);
          setError(null);
        }
        setOffers(offersRes.ok && !offersRes.body.error ? (offersRes.body.offers ?? []) : []);
        if (setupsRes.ok && !setupsRes.body.error) {
          setHasSetups(Boolean(setupsRes.body.hasSetups));
          setSetups(setupsRes.body.setups ?? []);
        } else {
          setHasSetups(false);
          setSetups([]);
        }
      } catch {
        if (!cancelled) setError("Could not load Floor Plan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [token, reloadTick]);

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/portal/floor-plans/${selectedId}?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json() as PortalFloorPlanDetail & { error?: string };
        if (cancelled) return;
        if (!r.ok || d.error || !d.plan) {
          setDetail(null);
          return;
        }
        setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => { cancelled = true; };
  }, [token, selectedId, reloadTick]);

  function addErrorMessage(code: string): string {
    switch (code) {
      case "add_not_permitted":
        return "Your venue has not allowed adding tables.";
      case "plan_ready":
        return "This layout is Ready — ask your venue to Make Changes if you need edits.";
      case "awaiting_review":
        return "This layout is with your venue for review — editing is paused.";
      case "plan_approved":
        return "Your venue approved this layout — placement is locked.";
      case "order_limit_reached":
        return "You've placed all of that item on your order. Ask your venue about adding more.";
      case "quantity_exceeded":
        return "No more of that item are available. Ask your venue about adding more.";
      case "quantity_not_configured":
        return "Ask your venue about adding more of that item.";
      case "outside_room":
        return "That placement is outside the room boundary.";
      case "type_not_permitted":
        return "That furniture type is not permitted for client addition.";
      case "inventory_not_found":
        return "That furniture item is not available.";
      default:
        return "Could not add that furniture.";
    }
  }

  async function openCatalog() {
    if (!selectedId) return;
    setCatalogOpen(true);
    setCatalogLoading(true);
    setAddError(null);
    try {
      const r = await fetch(
        `/api/portal/floor-plans/furniture-catalog?token=${encodeURIComponent(token)}&floorPlanId=${encodeURIComponent(selectedId)}`,
      );
      const d = await r.json() as PortalFloorPlanFurnitureCatalog & { error?: string };
      if (!r.ok || d.error) {
        setCatalog(null);
        setAddError(addErrorMessage(d.error ?? "catalog_failed"));
        return;
      }
      setCatalog(d);
    } catch {
      setCatalog(null);
      setAddError("Could not load furniture catalog.");
    } finally {
      setCatalogLoading(false);
    }
  }

  function openSubmitConfirm() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitOk(false);
    setSubmitConfirmOpen(true);
  }

  function cancelSubmitConfirm() {
    if (submitting) return;
    setSubmitConfirmOpen(false);
  }

  async function submitToVenue() {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitOk(false);
    try {
      const res = await fetch("/api/portal/floor-plans/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, floorPlanId: selectedId }),
      });
      const body = await res.json().catch(() => ({})) as {
        ok?: boolean;
        error?: string;
        alreadySubmitted?: boolean;
      };
      if (!res.ok || !body.ok) {
        setSubmitError(submitErrorMessage(body.error));
        setSubmitOk(false);
        setSubmitConfirmOpen(false);
        return;
      }
      setSubmitOk(true);
      setSubmitConfirmOpen(false);
      setReloadTick((n) => n + 1);
    } catch {
      setSubmitError("Could not submit right now. Please try again.");
      setSubmitOk(false);
      setSubmitConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  function submitErrorMessage(code?: string): string {
    switch (code) {
      case "plan_ready":
        return "This layout is already Ready for the event.";
      case "plan_approved":
        return "Your venue already approved this layout.";
      case "not_selected_layout":
        return "Submit the layout you selected for your event.";
      case "awaiting_review":
        return "This layout is already with your venue for review.";
      default:
        return "Could not submit this layout. Please try again.";
    }
  }

  async function addFromCatalog(item: PortalFloorPlanCatalogItem) {
    if (!selectedId || !item.addable) return;
    setAdding(true);
    setAddError(null);
    const roomW = Number(detail?.plan?.roomWidthFt) > 0 ? Number(detail?.plan?.roomWidthFt) * 12 : 800;
    const roomH = Number(detail?.plan?.roomDepthFt) > 0 ? Number(detail?.plan?.roomDepthFt) * 12 : 600;
    const placeW = Number(item.placeWidth ?? item.width ?? 60);
    const placeH = Number(item.placeHeight ?? item.length ?? 60);
    const x = Math.min(roomW - placeW / 2, Math.max(placeW / 2, roomW / 2));
    const y = Math.min(roomH - placeH / 2, Math.max(placeH / 2, roomH / 2));
    try {
      const r = await fetch("/api/portal/floor-plans/add-table", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          floorPlanId: selectedId,
          inventoryItemId: item.inventoryItemId ?? undefined,
          objectType: item.inventoryItemId ? undefined : item.objectType,
          x,
          y,
        }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setAddError(addErrorMessage(d.error ?? "add_failed"));
        return;
      }
      setCatalogOpen(false);
      setReloadTick((n) => n + 1);
    } catch {
      setAddError("Could not add that furniture.");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="animate-pulse text-sm">Loading Floor Plan…</div>
      </div>
    );
  }

  const plan = detail?.plan;
  const objects = detail?.objects ?? [];
  const hasOffers = offers.length > 0;
  const hasShared = list.length > 0;
  const coupleSelectedId =
    coupleSelectedIdFromApi
    ?? list.find((p) => p.isCoupleSelected)?.id
    ?? null;
  const showPackageView = hasSetups;
  const multiOffer = !showPackageView && offers.length > 1;
  /** Multi-offer: couple must select a working layout before furniture submit. */
  const requiresPreferenceSelection = multiOffer;
  const proposedReplacementPending = preferenceStatus === "proposed_replacement";
  const selectedSummary = list.find((p) => p.id === selectedId) ?? null;
  const selectedIsCoupleChoice = Boolean(plan?.isCoupleSelected ?? selectedSummary?.isCoupleSelected);
  const selectedIsReady = Boolean(
    plan?.isReady
      ?? selectedSummary?.isReady
      ?? list.some((p) => p.isReady),
  );
  const layoutStatus = normalizeClientLayoutStatus(
    plan?.clientLayoutStatus ?? selectedSummary?.clientLayoutStatus,
  );
  const hasSelectedWorking = Boolean(coupleSelectedId) || (hasShared && !multiOffer);
  /** Initial chooser only before review starts — never during submitted / changes / approved / Ready. */
  const awaitingInitialSelection =
    multiOffer
    && !coupleSelectedId
    && layoutStatus === "working"
    && !selectedIsReady
    && !proposedReplacementPending;
  /** Pre-submit multi-offer selector (not after furniture review has begun). */
  const showPreSubmitSelector =
    multiOffer
    && !proposedReplacementPending
    && !selectedIsReady
    && layoutStatus === "working"
    && Boolean(coupleSelectedId || awaitingInitialSelection);
  /** Post-submit / changes / approved: static layout summary; replacement when lifecycle allows. */
  const showPostSubmitLayoutSummary =
    multiOffer
    && (
      proposedReplacementPending
      || selectedIsReady
      || layoutStatus === "submitted"
      || layoutStatus === "changes_requested"
      || layoutStatus === "approved"
    );
  const canRequestDifferentLayout =
    multiOffer
    && !proposedReplacementPending
    && (layoutStatus === "approved" || selectedIsReady);
  // Pending replacement is view-only: never imply physical edits on either
  // the operational Ready layout or the requested (non-operational) copy.
  const canEditLayout = !proposedReplacementPending && clientMayEditLayout({
    clientLayoutStatus: layoutStatus,
    isReady: selectedIsReady,
  });
  const canSubmitLayout = !proposedReplacementPending && clientMaySubmitLayout({
    clientLayoutStatus: layoutStatus,
    isReady: selectedIsReady,
    // Once furniture review has begun (or Ready), a shared plan is the working layout
    // even if the couple-selected pointer was never written for multi-offer.
    isCoupleSelected:
      selectedIsCoupleChoice
      || Boolean(coupleSelectedId)
      || !requiresPreferenceSelection
      || layoutStatus === "changes_requested"
      || layoutStatus === "submitted"
      || layoutStatus === "approved"
      || selectedIsReady,
    requiresPreferenceSelection,
  });
  const mayAddTables = Boolean(plan?.coupleMayAddTables !== false) && canEditLayout;
  const editable = hasShared && canEditLayout;
  const reviewNote = plan?.clientReviewNote ?? selectedSummary?.clientReviewNote ?? null;
  // Effective seating permission from floor_plans.client_access (exposed as seatingEnabled).
  const seatingEnabled = Boolean(
    plan?.seatingEnabled === true
      || selectedSummary?.seatingEnabled === true
      || (selectedId
        ? list.find((p) => p.id === selectedId)?.seatingEnabled === true
        : list.some((p) => p.seatingEnabled === true)),
  );
  const guidance = portalFloorPlanGuidance({
    needsChooser: awaitingInitialSelection,
    hasWorkingShared: hasShared,
    hasSelectedWorking,
    clientLayoutStatus: layoutStatus,
    isReady: selectedIsReady,
    furnitureEditingAllowed: editable,
    coupleMayAddTables: mayAddTables,
    seatingEnabled,
    proposedReplacementPending,
  });
  const editingHelpItems = portalFloorPlanEditingHelpItems({
    furnitureEditingAllowed: editable,
    coupleMayAddTables: mayAddTables,
    canSubmit: Boolean(canSubmitLayout && guidance.showSubmitPrompt),
  });
  const capacitySummary = summarizeFloorPlanCapacity({
    objects: (detail?.objects ?? []).map((o) => ({
      objectType: o.objectType,
      capacity: o.capacity,
    })),
    guestCount: detail?.eventGuestCount ?? guestCountProp,
    spaceCapacity: detail?.spaceCapacity ?? null,
  });
  const capacityHasShortfall = floorPlanCapacityNeedsAttention(capacitySummary)
    && (capacitySummary.level === "seating_short" || capacitySummary.level === "both_short");
  const statusBadgeLabel = selectedIsReady
    ? "Ready"
    : proposedReplacementPending
      ? "Replacement requested"
      : clientLayoutStatusLabel(layoutStatus);
  const currentLayoutName = selectedSummary?.name ?? plan?.name ?? null;

  async function selectOfferLayout(offerId: string) {
    setRequestSelecting(true);
    setRequestError(null);
    try {
      const r = await fetch("/api/portal/floor-plan-offers/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, offerId }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setRequestError(d.error ?? "Could not update your layout choice.");
        return;
      }
      setRequestLayoutOpen(false);
      setReloadTick((n) => n + 1);
    } catch {
      setRequestError("Could not update your layout choice. Nothing was changed — you can try again.");
    } finally {
      setRequestSelecting(false);
    }
  }

  if (!hasOffers && !hasShared) {
    return (
      <div className="px-4 py-12 text-muted-foreground" data-testid="floor-plan-waiting-no-offer">
        <h2
          className="text-[24px] font-semibold leading-[30px] text-heading"
          data-testid="floor-plan-empty-heading"
        >
          Your Floor Plan
        </h2>
        <p className="text-[13px] mt-3 max-w-sm" data-testid="floor-plan-waiting-copy">
          Your venue hasn&apos;t shared a floor plan yet. Once one is available, you&apos;ll find it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 md:px-0">
      <FloorPlanSubmitConfirmDialog
        open={submitConfirmOpen}
        pending={submitting}
        onCancel={cancelSubmitConfirm}
        onConfirm={() => void submitToVenue()}
      />

      <Dialog open={requestLayoutOpen} onOpenChange={setRequestLayoutOpen}>
        <DialogContent className="sm:max-w-md" data-testid="floor-plan-request-layout-dialog">
          <DialogHeader>
            <DialogTitle>Request a different layout</DialogTitle>
            <DialogDescription>
              Your current approved arrangement will stay in place while your venue reviews this request.
              Guest seating is not moved automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            {offers
              .filter((o) => !o.isCurrentSelection)
              .map((o) => (
                <button
                  key={o.offerId}
                  type="button"
                  disabled={requestSelecting}
                  onClick={() => void selectOfferLayout(o.offerId)}
                  className="min-h-11 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium text-heading disabled:opacity-50"
                  data-testid="floor-plan-request-layout-option"
                >
                  {o.name}
                </button>
              ))}
          </div>
          {requestError && (
            <p className="text-xs text-destructive" data-testid="floor-plan-request-layout-error">
              {requestError}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {showPackageView ? (
        <WeddingSetupsSection
          token={token}
          setups={setups}
          onSelected={() => setReloadTick((n) => n + 1)}
        />
      ) : null}

      {/* Initial multi-offer pick before a working shared plan exists */}
      {awaitingInitialSelection && !hasShared && (
        <ChooseLayoutSection
          token={token}
          offers={offers}
          onSelected={() => setReloadTick((n) => n + 1)}
        />
      )}

      {(hasShared || (awaitingInitialSelection && hasShared)) && (
        <section className="space-y-3" data-testid="floor-plan-working-view">
          {/* A2 — Header */}
          <header className="space-y-1.5 pb-0" data-testid="floor-plan-header">
            <h2 className="text-[24px] font-semibold leading-[30px] text-heading">
              Your Floor Plan
            </h2>
            <span
              className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground"
              data-testid="floor-plan-status-label"
            >
              {statusBadgeLabel}
            </span>
            {selectedIsReady && (
              <span className="sr-only" data-testid="floor-plan-ready-badge">Ready for the event</span>
            )}
          </header>

          {/* A3 — Contextual instruction */}
          <div className="space-y-2" data-testid="floor-plan-guidance">
            <p
              className="text-[13px] leading-snug text-foreground"
              data-testid="floor-plan-guidance-copy"
            >
              {guidance.instruction}
            </p>
            <p className="sr-only" data-testid="floor-plan-guidance-headline">
              {guidance.headline}
            </p>
            {(layoutStatus === "changes_requested" || Boolean(reviewNote?.trim()))
              && reviewNote?.trim() && (
              <div
                className="rounded-xl border border-border bg-card px-3 py-2.5 space-y-1"
                data-testid="floor-plan-changes-note"
              >
                <p className="text-[11px] font-semibold text-heading">Notes from your venue</p>
                <p className="text-[13px] text-foreground whitespace-pre-wrap">{reviewNote.trim()}</p>
              </div>
            )}
          </div>

          {/* A4 — Layout selection / summary */}
          {showPreSubmitSelector && (
            <div className="space-y-2" data-testid="floor-plan-layout-selector">
              {awaitingInitialSelection && (
                <p className="text-[12px] text-muted-foreground" data-testid="floor-plan-choose-preference-copy">
                  Select the layout that works best for you — that becomes your working layout.
                </p>
              )}
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-0.5">
                {offers.map((o) => {
                  const active = Boolean(o.isCurrentSelection);
                  return (
                    <button
                      key={o.offerId}
                      type="button"
                      disabled={requestSelecting}
                      onClick={() => {
                        if (active) return;
                        void selectOfferLayout(o.offerId);
                      }}
                      className={`min-h-11 min-w-[7rem] shrink-0 rounded-xl border px-3 text-[13px] font-semibold transition-colors ${
                        active
                          ? "border-transparent text-white"
                          : "border-border bg-card text-heading"
                      }`}
                      style={active ? { background: SAGE } : undefined}
                      data-testid="floor-plan-layout-option"
                      aria-pressed={active}
                    >
                      {o.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showPostSubmitLayoutSummary && currentLayoutName && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
              data-testid="floor-plan-current-layout-summary"
            >
              <div className="min-w-0 space-y-2">
                {proposedReplacementPending ? (
                  <>
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground">Current approved layout</p>
                      <p className="text-sm font-semibold text-heading truncate" data-testid="floor-plan-approved-layout-name">
                        {list.find((p) => p.id === operationalId)?.name
                          ?? currentLayoutName}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground">Requested layout</p>
                      <p className="text-sm font-semibold text-heading truncate" data-testid="floor-plan-requested-layout-name">
                        {list.find((p) => p.id === coupleSelectedId)?.name
                          ?? "Awaiting venue review"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-medium text-muted-foreground">Selected layout</p>
                    <p className="text-sm font-semibold text-heading truncate">{currentLayoutName}</p>
                  </>
                )}
              </div>
              {canRequestDifferentLayout && (
                <button
                  type="button"
                  onClick={() => {
                    setRequestError(null);
                    setRequestLayoutOpen(true);
                  }}
                  className="min-h-11 shrink-0 rounded-xl border border-border bg-card px-3 text-[13px] font-semibold text-heading"
                  data-testid="floor-plan-request-different-layout"
                >
                  Request a different layout
                </button>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {selectedId && !plan && !error && (
            <div
              className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground"
              data-testid="floor-plan-detail-loading"
            >
              Loading your layout…
            </div>
          )}

          {/* A5 — Canvas */}
          {plan && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden mt-1">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-heading truncate">{plan.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {proposedReplacementPending
                      ? "View only — your current approved layout stays until your venue decides"
                      : selectedIsReady
                      ? "Ready — furniture placement is set"
                      : layoutStatus === "submitted"
                        ? "Submitted — awaiting venue review"
                        : layoutStatus === "approved"
                          ? "Approved — placement locked"
                          : layoutStatus === "changes_requested"
                            ? "Updates requested — edit, then send again"
                            : editable
                              ? "Drag unlocked items — changes save as you go"
                              : "Shared layout"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {mayAddTables && (
                    <button
                      type="button"
                      disabled={adding || catalogLoading}
                      onClick={() => void openCatalog()}
                      className="min-h-11 text-[13px] font-semibold px-3 rounded-xl border border-border text-heading bg-card disabled:opacity-50"
                      data-testid="floor-plan-add-table"
                    >
                      {catalogLoading ? "Loading…" : "Add furniture"}
                    </button>
                  )}
                </div>
              </div>
              <WorkingLayoutCanvas
                token={token}
                planName={plan.name}
                roomWidthFt={Number(plan.roomWidthFt)}
                roomDepthFt={Number(plan.roomDepthFt)}
                backgroundImageUrl={plan.backgroundImageUrl}
                backgroundImageOpacity={Number(plan.backgroundImageOpacity ?? 0.25)}
                objects={objects}
                editable={editable}
                onObjectsChange={(next) => {
                  setDetail((prev) => (prev ? { ...prev, objects: next } : prev));
                }}
              />
              {catalogOpen && (
                <div
                  className="border-t border-border px-4 py-3 space-y-3 bg-[#FAF8F5]"
                  data-testid="floor-plan-furniture-catalog"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-heading">Venue furniture</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Tables on your order can be placed up to the number you ordered. Other tables are limited
                        to what your venue has. Counts are for this layout.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground"
                      onClick={() => setCatalogOpen(false)}
                      data-testid="floor-plan-catalog-close"
                    >
                      Close
                    </button>
                  </div>
                  {catalogLoading && (
                    <p className="text-xs text-muted-foreground">Loading catalog…</p>
                  )}
                  {!catalogLoading && catalog && (
                    <div className="space-y-4">
                      {(catalog.inventoryItems?.length ?? 0) === 0
                        && (catalog.planTableTypes?.length ?? 0) === 0 && (
                        <p className="text-xs text-muted-foreground" data-testid="floor-plan-catalog-empty">
                          No addable furniture is configured yet. Ask your venue to mark tables available for floor
                          plans and set inventory quantities.
                        </p>
                      )}
                      {(catalog.inventoryItems ?? []).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Inventory
                          </p>
                          <ul className="space-y-2">
                            {catalog.inventoryItems.map((item) => (
                              <li
                                key={item.inventoryItemId}
                                className="rounded-xl border border-border bg-card px-3 py-2 flex items-start justify-between gap-3"
                                data-testid="floor-plan-catalog-item"
                                data-addable={item.addable ? "true" : "false"}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-heading truncate">{item.name}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {item.shape ?? item.objectType}
                                    {" · "}
                                    {catalogDimsLabel(item)}
                                    {item.capacity != null ? ` · ${item.capacity} seats` : ""}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground" data-testid="floor-plan-catalog-item-limit">
                                    {catalogLimitLabel(item)}
                                  </p>
                                </div>
                                {!item.addable && isLimitReason(item.unavailableReason) ? (
                                  <p
                                    className="shrink-0 max-w-[9rem] text-right text-[11px] text-muted-foreground"
                                    data-testid="floor-plan-catalog-ask-venue"
                                  >
                                    Ask your venue about adding more
                                  </p>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!item.addable || adding}
                                    onClick={() => void addFromCatalog(item)}
                                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border disabled:opacity-40"
                                    style={item.addable ? { background: SAGE, color: "#fff", borderColor: SAGE } : undefined}
                                    data-testid="floor-plan-catalog-add"
                                  >
                                    {item.addable ? (adding ? "Adding…" : "Add") : "Unavailable"}
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(catalog.planTableTypes ?? []).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Match layout tables
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Add another table like those already on this layout (system safety limit applies when
                            inventory quantity is not configured).
                          </p>
                          <ul className="space-y-2">
                            {catalog.planTableTypes.map((item) => (
                              <li
                                key={item.objectType}
                                className="rounded-xl border border-border bg-card px-3 py-2 flex items-start justify-between gap-3"
                                data-testid="floor-plan-catalog-plan-type"
                                data-addable={item.addable ? "true" : "false"}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-heading truncate">{item.name}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {catalogDimsLabel(item)}
                                    {item.capacity != null ? ` · ${item.capacity} seats` : ""}
                                    {" · "}
                                    {item.remaining} more can be added
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={!item.addable || adding}
                                  onClick={() => void addFromCatalog(item)}
                                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border disabled:opacity-40"
                                  style={item.addable ? { background: SAGE, color: "#fff", borderColor: SAGE } : undefined}
                                  data-testid="floor-plan-catalog-add-plan-type"
                                >
                                  {item.addable ? (adding ? "Adding…" : "Add") : "Unavailable"}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {addError && (
                <p className="text-xs text-destructive px-4 py-2" data-testid="floor-plan-add-error">{addError}</p>
              )}
              {plan.notes?.trim() && (
                <div className="px-4 py-3 border-t border-border">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
                  <p className="text-xs text-heading whitespace-pre-wrap">{plan.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* A6 — Primary action */}
          <div className="space-y-2 pt-1" data-testid="floor-plan-primary-action-slot">
            {canSubmitLayout && guidance.showSubmitPrompt && selectedId && (
              <button
                type="button"
                disabled={submitting}
                onClick={openSubmitConfirm}
                className="w-full min-h-11 text-[14px] font-semibold px-4 rounded-xl text-white disabled:opacity-50"
                style={{ background: SAGE }}
                data-testid="floor-plan-submit-to-venue"
              >
                {submitting ? "Sending…" : "Send layout for review"}
              </button>
            )}
            {!canSubmitLayout
              && hasShared
              && !selectedIsReady
              && layoutStatus === "working"
              && requiresPreferenceSelection
              && !coupleSelectedId && (
              <p
                className="text-[13px] text-amber-800"
                data-testid="floor-plan-submit-needs-preference"
              >
                Choose a starting layout above before you can send furniture placement for review.
              </p>
            )}
            {layoutStatus === "submitted" && !selectedIsReady && (
              <p
                className="text-[13px] text-muted-foreground"
                data-testid="floor-plan-submitted-badge"
              >
                Your layout is with your venue for review.
              </p>
            )}
            {layoutStatus === "approved" && !selectedIsReady && (
              <p
                className="text-[13px] text-muted-foreground"
                data-testid="floor-plan-approved-badge"
              >
                Your venue has approved this arrangement.
              </p>
            )}
            {(submitError || submitOk) && (
              <div>
                {submitError && (
                  <p className="text-xs text-destructive" data-testid="floor-plan-submit-error">{submitError}</p>
                )}
                {submitOk && !submitError && (
                  <p className="text-xs font-medium" style={{ color: SAGE }} data-testid="floor-plan-submit-success">
                    Sent to your venue. Placement is locked until they review.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* A7 — Compact capacity */}
          {capacitySummary.tableCount > 0 && (
            <div className="space-y-1.5 py-1" data-testid="floor-plan-client-capacity">
              <p
                className="text-[13px] text-muted-foreground"
                data-testid="floor-plan-client-capacity-sentence"
              >
                {formatFloorPlanCapacityCompact(capacitySummary)}
              </p>
              {capacityHasShortfall && (
                <div>
                  <button
                    type="button"
                    className="min-h-11 text-[13px] font-medium text-heading underline-offset-2 hover:underline"
                    onClick={() => setCapacityDetailsOpen((v) => !v)}
                    data-testid="floor-plan-capacity-details-toggle"
                    aria-expanded={capacityDetailsOpen}
                  >
                    View seating capacity details
                  </button>
                  {capacityDetailsOpen && (
                    <p
                      className="mt-1 text-[13px] text-foreground"
                      data-testid="floor-plan-capacity-details"
                    >
                      {formatFloorPlanCapacitySentence(capacitySummary)}
                      {detail?.spaceName ? ` · ${detail.spaceName}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* A8 — Editing help (collapsed) */}
          {guidance.showEditingHelp && editingHelpItems.length > 0 && (
            <div className="rounded-xl border border-border bg-card" data-testid="floor-plan-editing-help">
              <button
                type="button"
                className="flex w-full min-h-11 items-center justify-between gap-2 px-3 text-left text-[13px] font-semibold text-heading"
                onClick={() => setHelpOpen((v) => !v)}
                aria-expanded={helpOpen}
                data-testid="floor-plan-editing-help-toggle"
              >
                How to edit your layout
                <span className="text-muted-foreground font-normal">{helpOpen ? "Hide" : "Show"}</span>
              </button>
              {helpOpen && (
                <ul className="px-3 pb-3 text-[13px] text-muted-foreground space-y-1.5 list-disc pl-7">
                  {editingHelpItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* C2 — Guest Seating route */}
          {guidance.showGuestSeatingRoute && seatingEnabled && (
            <div
              className="rounded-xl border border-border bg-card px-3 py-3 space-y-2"
              data-testid="floor-plan-seating-next-hint"
            >
              <p className="text-[13px] text-foreground">
                Your layout is set. You can arrange your guests in Guest Seating.
              </p>
              <button
                type="button"
                className="min-h-11 w-full rounded-xl border border-border text-[13px] font-semibold text-heading"
                onClick={() => {
                  window.location.hash = "seating";
                }}
                data-testid="floor-plan-open-guest-seating"
              >
                Open Guest Seating
              </button>
            </div>
          )}
        </section>
      )}

      {awaitingInitialSelection && !hasShared && (
        <p className="text-[13px] text-muted-foreground text-center" data-testid="floor-plan-awaiting-selection-view">
          Choose a layout above to open your working plan.
        </p>
      )}
    </div>
  );
}

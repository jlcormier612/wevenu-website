"use client";

/**
 * Couple Floor Plan section (Phase 2):
 * - Zero offers / no shared plans → waiting state
 * - Shared plans appear when the venue shares (preference does not auto-share)
 * - Multiple offers → save preference only (pending venue review)
 * - Move unlocked furniture; add permitted tables (server-enforced)
 */

import * as React from "react";

import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { FloorPlanSubmitConfirmDialog } from "@/components/portal/floor-plan-submit-confirm-dialog";
import { OBJECT_STYLE } from "@/lib/floor-plans/constants";
import {
  formatFloorPlanCapacitySentence,
  summarizeFloorPlanCapacity,
} from "@/lib/floor-plans/capacity";
import {
  clientLayoutStatusHint,
  clientLayoutStatusLabel,
  clientMayEditLayout,
  clientMaySubmitLayout,
  normalizeClientLayoutStatus,
} from "@/lib/floor-plans/client-layout-review";
import {
  couplePreferenceStatusCopy,
  normalizeCouplePreferenceStatus,
} from "@/lib/floor-plans/preference-lifecycle";
import type { DisplayShape, ObjectType } from "@/lib/floor-plans/types";
import type {
  PortalFloorPlanCatalogItem,
  PortalFloorPlanDetail,
  PortalFloorPlanFurnitureCatalog,
  PortalFloorPlanObject,
  PortalFloorPlanOfferSummary,
  PortalFloorPlanSummary,
} from "@/lib/portal/types";

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
  const shape = obj.displayShape as DisplayShape | null;
  const style = shape ? DISPLAY_SHAPE_STYLE[shape] : legacyStyle;
  const fill = obj.color ?? style.fill;
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const fontSize = Math.max(9, Math.min(13, obj.width / 6));
  const transform = `rotate(${obj.rotation}, ${obj.x}, ${obj.y})`;
  const showCapacity = SEATABLE.has(obj.objectType) && obj.capacity != null && obj.capacity > 0;

  return (
    <g key={obj.id} transform={transform}>
      {obj.objectType === "text_label" ? null : shape ? (
        <FloorPlanShapeSvg
          shape={shape} x={obj.x} y={obj.y} width={obj.width} height={obj.height}
          fill={fill} stroke={style.stroke} strokeWidth={1.5}
        />
      ) : obj.objectType === "table_round" ? (
        <circle cx={obj.x} cy={obj.y} r={hw} fill={fill} stroke={style.stroke} strokeWidth={1.5} />
      ) : obj.objectType === "table_oval" ? (
        <ellipse cx={obj.x} cy={obj.y} rx={hw} ry={hh} fill={fill} stroke={style.stroke} strokeWidth={1.5} />
      ) : (
        <rect x={obj.x - hw} y={obj.y - hh} width={obj.width} height={obj.height} rx={3}
          fill={fill} stroke={style.stroke} strokeWidth={1.5} />
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
      <div className="overflow-auto bg-[#F7F5F1] p-3" data-testid="floor-plan-working-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          className="w-full h-auto max-h-[50vh] mx-auto block touch-none"
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
      const d = await r.json() as { ok?: boolean; error?: string; preferenceStatus?: string };
      if (!r.ok || !d.ok) {
        setSelectError(d.error ?? "Could not save your preference.");
        return;
      }
      onSelected();
    } catch {
      setSelectError("Could not save your preference. Nothing was changed — you can try again.");
    } finally {
      setSelecting(false);
    }
  }

  const active = offers.find((o) => o.offerId === previewOfferId) ?? null;

  return (
    <section className="space-y-3" data-testid="floor-plan-choose-layout">
      <div>
        <h2 className="text-lg font-semibold text-heading">Choose your preferred layout</h2>
        <p className="text-xs text-muted-foreground mt-0.5" data-testid="floor-plan-choose-preference-copy">
          Save a preference for your venue to review. This does not approve the layout or change what the venue
          uses, and it does not share seating by itself. This is not a multi-setup package — each option is a
          full layout for the celebration.
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
                ? "Current preference"
                : selecting
                  ? "Saving…"
                  : "Save as preference"}
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
  const [operationalId, setOperationalId] = React.useState<string | null>(null);
  const [coupleSelectedIdFromApi, setCoupleSelectedIdFromApi] = React.useState<string | null>(null);
  const [preferenceStatus, setPreferenceStatus] = React.useState<string | null>(null);
  const [approvedId, setApprovedId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PortalFloorPlanDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadTick, setReloadTick] = React.useState(0);
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = React.useState(false);
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

        const [plansRes, offersRes] = await Promise.all([
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
          setPreferenceStatus(plansRes.body.couplePreferenceStatus ?? null);
          setApprovedId(plansRes.body.coupleApprovedFloorPlanId ?? null);
          const preferred =
            (coupleSelected && plans.find((p) => p.id === coupleSelected)?.id)
            ?? (plansRes.body.operationalFloorPlanId
              && plans.find((p) => p.id === plansRes.body.operationalFloorPlanId)?.id)
            ?? plans[0]?.id
            ?? null;
          setSelectedId(preferred);
          setError(null);
        }
        setOffers(offersRes.ok && !offersRes.body.error ? (offersRes.body.offers ?? []) : []);
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
      case "quantity_exceeded":
        return "No more of that item are available for this event.";
      case "quantity_not_configured":
        return "Your venue has not set how many of this item are available. Ask them to set inventory quantity.";
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
  const needsChooser = offers.length > 1;
  const normalizedPreferenceStatus = normalizeCouplePreferenceStatus(
    preferenceStatus,
    coupleSelectedId,
  );
  const preferenceIsPending = normalizedPreferenceStatus === "pending" && Boolean(coupleSelectedId);
  const preferredOfferName =
    offers.find((o) => o.isCurrentSelection)?.name
    ?? list.find((p) => p.id === coupleSelectedId)?.name
    ?? null;
  const preferenceCopy = couplePreferenceStatusCopy({
    status: normalizedPreferenceStatus,
    preferredName: preferredOfferName,
    approvedAndShared: Boolean(
      normalizedPreferenceStatus === "approved"
      && approvedId
      && list.some((p) => p.id === approvedId),
    ),
  });
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
  const canEditLayout = clientMayEditLayout({
    clientLayoutStatus: layoutStatus,
    isReady: selectedIsReady,
  });
  const canSubmitLayout = clientMaySubmitLayout({
    clientLayoutStatus: layoutStatus,
    isReady: selectedIsReady,
    isCoupleSelected: selectedIsCoupleChoice,
  });
  const mayAddTables = Boolean(plan?.coupleMayAddTables !== false) && canEditLayout;
  const editable = hasShared && canEditLayout;
  const reviewNote = plan?.clientReviewNote ?? selectedSummary?.clientReviewNote ?? null;

  if (!hasOffers && !hasShared) {
    return (
      <div className="text-center py-16 text-muted-foreground" data-testid="floor-plan-waiting-no-offer">
        <div className="text-3xl mb-3">🗺️</div>
        <p className="text-sm font-medium text-heading">Waiting on a layout from your venue</p>
        <p className="text-xs mt-1 max-w-sm mx-auto" data-testid="floor-plan-waiting-copy">
          Your venue has not offered or shared a floor plan for this event yet. When they share one, it
          appears here. Saving a preference later does not by itself mean they approved it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <FloorPlanSubmitConfirmDialog
        open={submitConfirmOpen}
        pending={submitting}
        onCancel={cancelSubmitConfirm}
        onConfirm={() => void submitToVenue()}
      />
      {needsChooser && (
        <ChooseLayoutSection
          token={token}
          offers={offers}
          onSelected={() => setReloadTick((n) => n + 1)}
        />
      )}

      {normalizedPreferenceStatus && (
        <div
          className={`rounded-xl border px-4 py-3 space-y-1 ${
            preferenceIsPending
              ? "border-amber-200 bg-amber-50/80"
              : "border-border bg-muted/20"
          }`}
          data-testid={
            preferenceIsPending
              ? "floor-plan-preference-pending-banner"
              : `floor-plan-preference-${normalizedPreferenceStatus}-banner`
          }
        >
          <p className="text-sm font-medium text-heading">{preferenceCopy.headline}</p>
          <p className="text-xs text-muted-foreground">{preferenceCopy.detail}</p>
          {preferenceIsPending && needsChooser && (
            <p className="text-xs text-muted-foreground">
              Choose another option above if you want to change your preference.
            </p>
          )}
        </div>
      )}

      {hasShared && (
        <section className="space-y-4" data-testid="floor-plan-working-view">
          <div>
            <h2 className="text-lg font-semibold text-heading">Your Floor Plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5" data-testid="floor-plan-status-label">
              {selectedIsReady
                ? "This layout is Ready for the event. Furniture placement is locked."
                : clientLayoutStatusLabel(layoutStatus)}
            </p>
            {selectedIsReady && (
              <p className="text-xs font-medium mt-1" style={{ color: SAGE }} data-testid="floor-plan-ready-badge">
                Ready for the event
              </p>
            )}
          </div>

          <div
            className="rounded-2xl border border-border bg-card px-4 py-3 space-y-2"
            data-testid="floor-plan-guidance"
          >
            <p className="text-sm font-medium text-heading">
              {selectedSummary?.name ?? plan?.name ?? "Shared layout"}
              {selectedIsCoupleChoice ? " · Your preference" : ""}
              {normalizedPreferenceStatus === "approved" && (plan?.isCoupleApproved || selectedId === approvedId)
                ? " · Venue approved"
                : ""}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="floor-plan-guidance-copy">
              {selectedIsCoupleChoice && normalizedPreferenceStatus === "pending"
                ? "Your preference is waiting on venue review. It does not mean they approved it or will use it yet — sharing and seating stay separate."
                : normalizedPreferenceStatus === "approved"
                  && (plan?.isCoupleApproved || selectedId === approvedId)
                  && (plan?.isOperational || selectedId === operationalId)
                  && selectedSummary
                  ? "Your venue approved this preference and it is their working layout. You see it because they also shared it."
                  : selectedIsReady
                    ? "Your venue marked this layout Ready. Placement and furniture adds are locked."
                    : clientLayoutStatusHint(layoutStatus)}
            </p>
            {preferenceIsPending && selectedIsCoupleChoice && (
              <p className="text-xs text-muted-foreground" data-testid="floor-plan-preference-pending-on-shared">
                Your preference on this shared layout is still pending venue review.
              </p>
            )}
            {layoutStatus === "changes_requested" && reviewNote?.trim() && (
              <p
                className="text-xs rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-950"
                data-testid="floor-plan-changes-note"
              >
                From your venue: {reviewNote.trim()}
              </p>
            )}
            {(() => {
              const capacitySummary = summarizeFloorPlanCapacity({
                objects: (detail?.objects ?? []).map((o) => ({
                  objectType: o.objectType,
                  capacity: o.capacity,
                })),
                guestCount: detail?.eventGuestCount ?? guestCountProp,
                spaceCapacity: detail?.spaceCapacity ?? null,
              });
              if (capacitySummary.tableCount === 0) return null;
              return (
                <div
                  className="rounded-xl border border-border bg-muted/20 px-3 py-2 space-y-1"
                  data-testid="floor-plan-client-capacity"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Layout capacity
                  </p>
                  <p className="text-xs text-heading" data-testid="floor-plan-client-capacity-sentence">
                    {formatFloorPlanCapacitySentence(capacitySummary)}
                    {detail?.spaceName ? ` · ${detail.spaceName}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Guest count is what your venue recorded for this event — not how many people
                    are already assigned to seats. Layout seats count tables on this canvas
                    (including ceremony/cocktail areas when shown). Zone titles are visual areas
                    on one layout, not separate timed setups. Open the furniture catalog to see
                    which items you may add and how many remain.
                  </p>
                </div>
              );
            })()}
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              <li>Locked items (gray lock mark) stay where your venue placed them.</li>
              <li>
                {(plan?.coupleMayAddTables ?? selectedSummary?.coupleMayAddTables) === false
                  ? "Your venue has turned off adding furniture on this layout."
                  : "You may add tables your venue permits, within their inventory limits shown in the catalog."}
              </li>
              <li>Seat guests on the Seating tab when seating is open (separate from layout capacity).</li>
              <li>When the arrangement looks right, submit it so your venue can review — editing locks until they respond.</li>
            </ul>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {canSubmitLayout && selectedId && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={openSubmitConfirm}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl text-white disabled:opacity-50"
                  style={{ background: SAGE }}
                  data-testid="floor-plan-submit-to-venue"
                >
                  {submitting ? "Submitting…" : "Submit floor plan to venue"}
                </button>
              )}
              {layoutStatus === "submitted" && !selectedIsReady && (
                <span
                  className="text-[11px] font-medium px-2 py-1 rounded-full border"
                  style={{ borderColor: `${SAGE}55`, color: SAGE }}
                  data-testid="floor-plan-submitted-badge"
                >
                  With venue for review
                </span>
              )}
              {layoutStatus === "approved" && !selectedIsReady && (
                <span
                  className="text-[11px] font-medium px-2 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary"
                  data-testid="floor-plan-approved-badge"
                >
                  Approved by venue
                </span>
              )}
            </div>
            {(submitError || submitOk) && (
              <div>
                {submitError && (
                  <p className="text-xs text-destructive" data-testid="floor-plan-submit-error">{submitError}</p>
                )}
                {submitOk && !submitError && (
                  <p className="text-xs font-medium" style={{ color: SAGE }} data-testid="floor-plan-submit-success">
                    Submitted to your venue. Placement is locked until they review.
                  </p>
                )}
              </div>
            )}
          </div>

          {list.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {list.map((p) => {
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                      active ? "border-transparent text-white" : "border-border text-heading bg-card"
                    }`}
                    style={active ? { background: SAGE } : undefined}
                  >
                    {p.name}
                    {p.isCoupleSelected ? " · Your preference" : ""}
                    {p.isCoupleApproved ? " · Approved" : ""}
                    {p.isReady ? " · Ready" : ""}
                    {!p.isCoupleSelected && (p.isOperational || p.id === operationalId) ? " · Venue working layout" : ""}
                  </button>
                );
              })}
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

          {plan && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-heading">{plan.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedIsReady
                      ? "Ready for the event — furniture placement is set"
                      : layoutStatus === "submitted"
                        ? "Submitted — awaiting venue review"
                        : layoutStatus === "approved"
                          ? "Approved — placement locked"
                          : layoutStatus === "changes_requested"
                            ? "Updates requested — edit, then submit again"
                            : selectedIsCoupleChoice || plan.isOperational
                              ? "Working copy — drag unlocked items; changes save as you go"
                              : "Shared layout"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {mayAddTables && (
                    <button
                      type="button"
                      disabled={adding || catalogLoading}
                      onClick={() => void openCatalog()}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-border text-heading bg-card disabled:opacity-50"
                      data-testid="floor-plan-add-table"
                    >
                      {catalogLoading ? "Loading…" : "Add furniture"}
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {objects.length} element{objects.length === 1 ? "" : "s"}
                    {objects.filter((o) => SEATABLE.has(o.objectType)).length > 0
                      ? ` · ${objects.filter((o) => SEATABLE.has(o.objectType)).reduce((s, o) => s + (o.capacity ?? 0), 0)} seats`
                      : ""}
                  </p>
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
                        Choose from your venue&apos;s catalog. Quantities and dimensions come from venue inventory —
                        items without a configured quantity cannot be added.
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
                                  <p className="text-[11px] text-muted-foreground">
                                    {item.quantityConfigured
                                      ? `${item.remaining} of ${item.quantityAvailable} remaining (venue inventory)`
                                      : "Quantity not set by venue"}
                                  </p>
                                </div>
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
                                    {item.remaining} remaining (cap {item.quantityAvailable})
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

          <p className="text-xs text-muted-foreground text-center" data-testid="floor-plan-seating-next-hint">
            Seating is available now — open Seating to assign guests to tables.
          </p>
        </section>
      )}

      {needsChooser && !hasShared && (
        <p className="text-xs text-muted-foreground text-center" data-testid="floor-plan-awaiting-selection-view">
          Choose a layout above to open your working plan and seating.
        </p>
      )}
    </div>
  );
}

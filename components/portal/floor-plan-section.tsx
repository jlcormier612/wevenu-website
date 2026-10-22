"use client";

/**
 * Couple Floor Plan section:
 * - Zero offers → waiting state
 * - Sole offer → auto-assign (ensure) → working plan + seating
 * - Multiple offers → choose → working plan + seating
 * - Move unlocked furniture; add permitted tables (server-enforced)
 */

import * as React from "react";

import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { OBJECT_STYLE } from "@/lib/floor-plans/constants";
import type { DisplayShape, ObjectType } from "@/lib/floor-plans/types";
import type {
  PortalFloorPlanDetail,
  PortalFloorPlanObject,
  PortalFloorPlanOfferSummary,
  PortalFloorPlanSummary,
} from "@/lib/portal/types";

const SAGE = "#5F8A5B";

function renderObjectStatic(obj: PortalFloorPlanObject): React.ReactNode {
  const legacyStyle = OBJECT_STYLE[obj.objectType as ObjectType] ?? OBJECT_STYLE.other;
  const shape = obj.displayShape as DisplayShape | null;
  const style = shape ? DISPLAY_SHAPE_STYLE[shape] : legacyStyle;
  const fill = obj.color ?? style.fill;
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const fontSize = Math.max(9, Math.min(13, obj.width / 6));
  const transform = `rotate(${obj.rotation}, ${obj.x}, ${obj.y})`;

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
        <text x={obj.x} y={obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fill={style.textFill} fontFamily="sans-serif">
          {obj.label}
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
  } | null>(null);

  React.useEffect(() => {
    setLocalObjects(objects);
  }, [objects]);

  function clientToSvgScale(svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      scaleX: vb.width / Math.max(rect.width, 1),
      scaleY: vb.height / Math.max(rect.height, 1),
    };
  }

  function onPointerDown(e: React.PointerEvent, obj: PortalFloorPlanObject) {
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
    };
    setMoveError(null);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startClientX) * drag.scaleX;
    const dy = (e.clientY - drag.startClientY) * drag.scaleY;
    const nx = drag.originX + dx;
    const ny = drag.originY + dy;
    drag.lastX = nx;
    drag.lastY = ny;
    setLocalObjects((prev) =>
      prev.map((o) => (o.id === drag.id ? { ...o, x: nx, y: ny } : o)),
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

  const roomW = Number(roomWidthFt) * 12 || 800;
  const roomH = Number(roomDepthFt) * 12 || 600;
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
          {backgroundImageUrl && (
            <image
              href={backgroundImageUrl}
              x={0} y={0} width={canvasW} height={canvasH}
              opacity={Number(backgroundImageOpacity ?? 0.25)}
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          {localObjects.map((obj) => {
            const locked = Boolean(obj.locked);
            const canDrag = editable && !locked;
            return (
              <g
                key={obj.id}
                style={{ cursor: canDrag ? "grab" : locked ? "not-allowed" : "default" }}
                onPointerDown={(e) => onPointerDown(e, obj)}
                data-testid={locked ? "floor-plan-object-locked" : "floor-plan-object-movable"}
                data-object-id={obj.id}
              >
                {renderObjectStatic(obj)}
              </g>
            );
          })}
        </svg>
      </div>
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
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setSelectError(d.error ?? "Could not save your choice.");
        return;
      }
      onSelected();
    } catch {
      setSelectError("Could not save your choice.");
    } finally {
      setSelecting(false);
    }
  }

  const active = offers.find((o) => o.offerId === previewOfferId) ?? null;

  return (
    <section className="space-y-3" data-testid="floor-plan-choose-layout">
      <div>
        <h2 className="text-lg font-semibold text-heading">Choose your layout</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your venue has shared a few ways to arrange the space. Choose the one that works best for your celebration.
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
                ? "Selected"
                : selecting
                  ? "Saving…"
                  : "Choose this layout"}
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

export default function FloorPlanSection({ token }: { token: string }) {
  const [list, setList] = React.useState<PortalFloorPlanSummary[]>([]);
  const [offers, setOffers] = React.useState<PortalFloorPlanOfferSummary[]>([]);
  const [operationalId, setOperationalId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PortalFloorPlanDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadTick, setReloadTick] = React.useState(0);
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

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

  async function addTable() {
    if (!selectedId) return;
    setAdding(true);
    setAddError(null);
    try {
      const r = await fetch("/api/portal/floor-plans/add-table", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          floorPlanId: selectedId,
          objectType: "table_round",
          x: 220,
          y: 220,
        }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        const code = d.error ?? "add_failed";
        setAddError(
          code === "add_not_permitted" ? "Your venue has not allowed adding tables."
            : code === "plan_ready" ? "This layout is Ready — ask your venue to Make Changes if you need edits."
              : "Could not add a table.",
        );
        return;
      }
      setReloadTick((n) => n + 1);
    } catch {
      setAddError("Could not add a table.");
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
  const coupleSelectedId = list.find((p) => p.isCoupleSelected)?.id ?? null;
  const needsChooser = offers.length > 1 && !coupleSelectedId;
  const selectedSummary = list.find((p) => p.id === selectedId) ?? null;
  const selectedIsCoupleChoice = Boolean(plan?.isCoupleSelected ?? selectedSummary?.isCoupleSelected);
  const selectedIsReady = Boolean(
    plan?.isReady
      ?? selectedSummary?.isReady
      ?? list.some((p) => p.isReady),
  );
  const mayAddTables = Boolean(plan?.coupleMayAddTables !== false) && !selectedIsReady;
  const editable = hasShared && !selectedIsReady;

  if (!hasOffers && !hasShared) {
    return (
      <div className="text-center py-16 text-muted-foreground" data-testid="floor-plan-waiting-no-offer">
        <div className="text-3xl mb-3">🗺️</div>
        <p className="text-sm font-medium text-heading">Waiting on a layout from your venue</p>
        <p className="text-xs mt-1 max-w-sm mx-auto">
          Your venue has not offered a floor plan for this event yet. Once they do, your working layout
          and seating will open here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {needsChooser && (
        <ChooseLayoutSection
          token={token}
          offers={offers}
          onSelected={() => setReloadTick((n) => n + 1)}
        />
      )}

      {hasShared && (
        <section className="space-y-4" data-testid="floor-plan-working-view">
          <div>
            <h2 className="text-lg font-semibold text-heading">Your Floor Plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedIsReady
                ? "This layout is Ready for the event. Furniture placement is locked."
                : "Arrange unlocked furniture, add permitted tables, and seat guests in Seating."}
            </p>
            {selectedIsReady && (
              <p className="text-xs font-medium mt-1" style={{ color: SAGE }} data-testid="floor-plan-ready-badge">
                Ready for the event
              </p>
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
                    {p.isCoupleSelected ? " · Your choice" : ""}
                    {p.isReady ? " · Ready" : ""}
                    {!p.isCoupleSelected && (p.isOperational || p.id === operationalId) ? " · Operational" : ""}
                  </button>
                );
              })}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {plan && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-heading">{plan.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedIsReady
                      ? "Ready for the event — furniture placement is set"
                      : selectedIsCoupleChoice || plan.isOperational
                        ? "Your working layout — drag unlocked items to rearrange"
                        : "Shared layout"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {mayAddTables && (
                    <button
                      type="button"
                      disabled={adding}
                      onClick={() => void addTable()}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-border text-heading bg-card disabled:opacity-50"
                      data-testid="floor-plan-add-table"
                    >
                      {adding ? "Adding…" : "Add table"}
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {objects.length} element{objects.length === 1 ? "" : "s"}
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

"use client";

/**
 * Couple Floor Plan section:
 * - Phase 1: view-only shared event plans (shared_with_couple)
 * - Phase 2: Choose your layout when venue offers templates (no auto-share)
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

function renderObject(obj: PortalFloorPlanObject): React.ReactNode {
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
  const canvasW = Number(roomWidthFt) * 12 || 800;
  const canvasH = Number(roomDepthFt) * 12 || 600;
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
        {objects.map(renderObject)}
      </svg>
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
    <section className="space-y-3">
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
              <p className="text-[11px] text-muted-foreground">Preview — view only</p>
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
  const [offersTick, setOffersTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/portal/floor-plans?token=${encodeURIComponent(token)}`).then(async (r) => ({
        ok: r.ok,
        body: await r.json() as {
          floorPlans?: PortalFloorPlanSummary[];
          operationalFloorPlanId?: string | null;
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
    ])
      .then(([plansRes, offersRes]) => {
        if (cancelled) return;
        if (!plansRes.ok || plansRes.body.error) {
          setError(plansRes.body.error ?? "Could not load Floor Plan.");
          setList([]);
        } else {
          const plans = plansRes.body.floorPlans ?? [];
          setList(plans);
          setOperationalId(plansRes.body.operationalFloorPlanId ?? null);
          const preferred =
            (plansRes.body.operationalFloorPlanId
              && plans.find((p) => p.id === plansRes.body.operationalFloorPlanId)?.id)
            ?? plans[0]?.id
            ?? null;
          setSelectedId(preferred);
          setError(null);
        }
        setOffers(offersRes.ok && !offersRes.body.error ? (offersRes.body.offers ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Floor Plan.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, offersTick]);

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
  }, [token, selectedId]);

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

  if (!hasOffers && !hasShared) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <div className="text-3xl mb-3">🗺️</div>
        <p className="text-sm font-medium text-heading">No Floor Plan shared yet</p>
        <p className="text-xs mt-1 max-w-sm mx-auto">
          When your venue shares a layout, you&apos;ll see the room and all physical elements here —
          separate from seating guests at tables.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {hasOffers && (
        <ChooseLayoutSection
          token={token}
          offers={offers}
          onSelected={() => setOffersTick((n) => n + 1)}
        />
      )}

      {hasShared && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">Floor Plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Where the physical things are in the room — view only.
            </p>
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
                    {p.isOperational || p.id === operationalId ? " · Operational" : ""}
                  </button>
                );
              })}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {plan && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-heading">{plan.name}</p>
                  {plan.isOperational && (
                    <p className="text-[11px] text-muted-foreground">This event&apos;s operational Floor Plan</p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground shrink-0">
                  {objects.length} element{objects.length === 1 ? "" : "s"}
                </p>
              </div>
              <LayoutPreviewSvg
                planName={plan.name}
                roomWidthFt={Number(plan.roomWidthFt)}
                roomDepthFt={Number(plan.roomDepthFt)}
                backgroundImageUrl={plan.backgroundImageUrl}
                backgroundImageOpacity={Number(plan.backgroundImageOpacity ?? 0.25)}
                objects={objects}
              />
              {plan.notes?.trim() && (
                <div className="px-4 py-3 border-t border-border">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
                  <p className="text-xs text-heading whitespace-pre-wrap">{plan.notes}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {hasOffers && !hasShared && (
        <p className="text-xs text-muted-foreground text-center">
          Your venue will share the Floor Plan view when they&apos;re ready — choosing a layout doesn&apos;t share it automatically.
        </p>
      )}
    </div>
  );
}

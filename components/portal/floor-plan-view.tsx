"use client";

/**
 * Couple-facing Floor Plan presentation (shared plans only).
 * Mutations (choose layout) stay in FloorPlanSection — preview mounts this view read-only.
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

export function FloorPlanLayoutSvg({
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
  backgroundImageOpacity?: number | null;
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
        {objects.map(renderObject)}
      </svg>
    </div>
  );
}

export type FloorPlanPortalViewModel = {
  list: PortalFloorPlanSummary[];
  offers: PortalFloorPlanOfferSummary[];
  operationalFloorPlanId: string | null;
  /** Preloaded plan details keyed by plan id (shared plans only). */
  detailsById: Record<string, PortalFloorPlanDetail>;
  /** Offer preview payloads keyed by offer id (read-only). */
  offerPreviewsById?: Record<string, {
    name: string;
    roomWidthFt: number;
    roomDepthFt: number;
    backgroundImageUrl: string | null;
    backgroundImageOpacity: number;
    objects: PortalFloorPlanObject[];
  }>;
};

export function FloorPlanPortalView({
  data,
  staffPreviewLabel,
}: {
  data: FloorPlanPortalViewModel;
  staffPreviewLabel?: string | null;
}) {
  const { list, offers, operationalFloorPlanId, detailsById, offerPreviewsById = {} } = data;
  const hasOffers = offers.length > 0;
  const hasShared = list.length > 0;
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () =>
      (operationalFloorPlanId && list.find((p) => p.id === operationalFloorPlanId)?.id)
      ?? list[0]?.id
      ?? null,
  );
  const [previewOfferId, setPreviewOfferId] = React.useState<string | null>(
    () => offers.find((o) => o.isCurrentSelection)?.offerId ?? offers[0]?.offerId ?? null,
  );

  React.useEffect(() => {
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [list, selectedId]);

  if (!hasOffers && !hasShared) {
    return (
      <div className="text-center py-16 text-muted-foreground" data-testid="floor-plan-portal-empty">
        <div className="text-3xl mb-3">🗺️</div>
        <p className="text-sm font-medium text-heading">No Floor Plan shared yet</p>
        <p className="text-xs mt-1 max-w-sm mx-auto">
          When your venue shares a layout, you&apos;ll see the room and all physical elements here —
          separate from seating guests at tables.
        </p>
      </div>
    );
  }

  const detail = selectedId ? detailsById[selectedId] ?? null : null;
  const plan = detail?.plan;
  const objects = detail?.objects ?? [];
  const selectedSummary = list.find((p) => p.id === selectedId) ?? null;
  const selectedIsReady = Boolean(plan?.isReady ?? selectedSummary?.isReady);
  const selectedIsCoupleChoice = Boolean(plan?.isCoupleSelected ?? selectedSummary?.isCoupleSelected);
  const offerPreview = previewOfferId ? offerPreviewsById[previewOfferId] ?? null : null;
  const activeOffer = offers.find((o) => o.offerId === previewOfferId) ?? null;

  return (
    <div className="space-y-8" data-testid="floor-plan-portal-view">
      {staffPreviewLabel ? (
        <p className="text-xs text-muted-foreground text-center">{staffPreviewLabel}</p>
      ) : null}

      {hasOffers && (
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
          {offerPreview && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-heading">{offerPreview.name}</p>
                  <p className="text-[11px] text-muted-foreground">Preview — view only</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl text-muted-foreground border border-border">
                  {activeOffer?.isCurrentSelection ? "Selected" : "Choose this layout (preview only)"}
                </span>
              </div>
              <FloorPlanLayoutSvg
                planName={offerPreview.name}
                roomWidthFt={offerPreview.roomWidthFt}
                roomDepthFt={offerPreview.roomDepthFt}
                backgroundImageUrl={offerPreview.backgroundImageUrl}
                backgroundImageOpacity={offerPreview.backgroundImageOpacity}
                objects={offerPreview.objects}
              />
            </div>
          )}
        </section>
      )}

      {hasShared && (
        <section className="space-y-4" data-testid="floor-plan-working-view">
          <div>
            <h2 className="text-lg font-semibold text-heading">Your working layout</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The room layout for your event — view only. Your venue places furniture;
              you assign guests once they open Seating.
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
                    {!p.isCoupleSelected && (p.isOperational || p.id === operationalFloorPlanId) ? " · Operational" : ""}
                  </button>
                );
              })}
            </div>
          )}
          {plan && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-heading">{plan.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {plan.isReady
                      ? "Ready for the event — furniture placement is set"
                      : plan.isCoupleSelected || plan.isOperational
                        ? "Your selected working layout — furniture is placed by your venue"
                        : "Shared layout — view only"}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground shrink-0">
                  {objects.length} element{objects.length === 1 ? "" : "s"}
                </p>
              </div>
              <FloorPlanLayoutSvg
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
          <p className="text-xs text-muted-foreground text-center" data-testid="floor-plan-seating-next-hint">
            To seat guests at tables, open Seating when your venue has shared this plan for seating.
          </p>
        </section>
      )}

      {hasOffers && !hasShared && (
        <p className="text-xs text-muted-foreground text-center" data-testid="floor-plan-awaiting-selection-view">
          Choose a layout above to save your selection. Your working layout will appear here once you choose.
        </p>
      )}
    </div>
  );
}

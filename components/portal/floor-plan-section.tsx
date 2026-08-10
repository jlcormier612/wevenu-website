"use client";

/**
 * Phase 1 — Couple Floor Plan (view-only).
 * "Where are the physical things?" — all floor_plan_objects, not seating tables only.
 * Independent of Seating (Enable Seating / client_access).
 */

import * as React from "react";

import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { OBJECT_STYLE } from "@/lib/floor-plans/constants";
import type { DisplayShape, ObjectType } from "@/lib/floor-plans/types";
import type { PortalFloorPlanDetail, PortalFloorPlanObject, PortalFloorPlanSummary } from "@/lib/portal/types";

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

export default function FloorPlanSection({ token }: { token: string }) {
  const [list, setList] = React.useState<PortalFloorPlanSummary[]>([]);
  const [operationalId, setOperationalId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PortalFloorPlanDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/portal/floor-plans?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json() as {
          floorPlans?: PortalFloorPlanSummary[];
          operationalFloorPlanId?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok || d.error) {
          setError(d.error ?? "Could not load Floor Plan.");
          setList([]);
          return;
        }
        const plans = d.floorPlans ?? [];
        setList(plans);
        setOperationalId(d.operationalFloorPlanId ?? null);
        const preferred =
          (d.operationalFloorPlanId && plans.find((p) => p.id === d.operationalFloorPlanId)?.id)
          ?? plans[0]?.id
          ?? null;
        setSelectedId(preferred);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Floor Plan.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

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
          setError(d.error ?? "Could not open Floor Plan.");
          return;
        }
        setError(null);
        setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setError("Could not open Floor Plan.");
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

  if (list.length === 0) {
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

  const plan = detail?.plan;
  const objects = detail?.objects ?? [];
  const canvasW = plan ? Number(plan.roomWidthFt) * 12 : 800;
  const canvasH = plan ? Number(plan.roomDepthFt) * 12 : 600;

  return (
    <div className="space-y-4">
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

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

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
          <div className="overflow-auto bg-[#F7F5F1] p-3">
            <svg
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              className="w-full h-auto max-h-[70vh] mx-auto block"
              role="img"
              aria-label={`Floor Plan: ${plan.name}`}
            >
              <rect x={0} y={0} width={canvasW} height={canvasH} fill="#F7F5F1" />
              {plan.backgroundImageUrl && (
                <image
                  href={plan.backgroundImageUrl}
                  x={0} y={0} width={canvasW} height={canvasH}
                  opacity={Number(plan.backgroundImageOpacity ?? 0.25)}
                  preserveAspectRatio="xMidYMid slice"
                />
              )}
              {objects.map(renderObject)}
            </svg>
          </div>
          {plan.notes?.trim() && (
            <div className="px-4 py-3 border-t border-border">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
              <p className="text-xs text-heading whitespace-pre-wrap">{plan.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

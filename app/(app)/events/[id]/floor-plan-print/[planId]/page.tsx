import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintButton } from "@/app/(app)/events/[id]/floor-plan-print/print-button";
import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { getEvent } from "@/lib/events/service";
import { getFloorPlan } from "@/lib/floor-plans/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { OBJECT_STYLE } from "@/lib/floor-plans/constants";
import type { FloorPlanObject } from "@/lib/floor-plans/types";

type Props = { params: Promise<{ id: string; planId: string }> };

export const metadata: Metadata = { title: "Floor Plan — Print" };

/**
 * Print-friendly floor plan page, scoped to one floor plan by its own id —
 * a booking may hold many (Booking Floor Plan Workspace task), each with
 * its own Print button pointing here.
 * Opens in a new tab; browser print dialog handles PDF export.
 * The SVG scales to fill the page at any size with no quality loss.
 */
export default async function FloorPlanPrintPage({ params }: Props) {
  const { id, planId } = await params;
  const [event, plan, venue] = await Promise.all([getEvent(id), getFloorPlan(planId), getCurrentVenue()]);
  if (!event || !venue || !plan || plan.eventId !== id) notFound();

  // Canvas units are inches; 1 ft = 12 units regardless of room size, so this
  // is always exactly the same canvas the editor renders for this plan
  // (Floor Plan Editor Completion). Existing plans were backfilled to
  // 66.67 x 50 ft — i.e. exactly 800x600 — so pre-existing prints are
  // pixel-for-pixel unchanged by this.
  const CANVAS_WIDTH = plan.roomWidthFt * 12;
  const CANVAS_HEIGHT = plan.roomDepthFt * 12;

  function renderObject(obj: FloorPlanObject): React.ReactNode {
    // Same fallback rule as the editor (Floor Plan Completion — Phase 2):
    // the shape library renders whenever an object carries a displayShape;
    // objects placed before it existed fall back to the original
    // object_type-based rendering, unchanged from before this shape library.
    const legacyStyle = OBJECT_STYLE[obj.objectType];
    const style = obj.displayShape ? DISPLAY_SHAPE_STYLE[obj.displayShape] : legacyStyle;
    const fill = obj.color ?? style.fill;
    const hw = obj.width / 2;
    const hh = obj.height / 2;
    const fontSize = Math.max(9, Math.min(13, obj.width / 6));
    const key = obj.id;
    const transform = `rotate(${obj.rotation}, ${obj.x}, ${obj.y})`;

    return (
      <g key={key} transform={transform}>
        {obj.objectType === "text_label" ? null : obj.displayShape ? (
          <FloorPlanShapeSvg
            shape={obj.displayShape} x={obj.x} y={obj.y} width={obj.width} height={obj.height}
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

  return (
    <>
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.4in; }
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
        }
        body { background: #f5f4f2; font-family: sans-serif; }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        {/* Screen-only toolbar */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <a href={`/events/${id}/floor-plans/${planId}`} style={{ fontSize: 14, color: "#5D6F5D", textDecoration: "none" }}>← Back to {plan.name}</a>
          <PrintButton />
        </div>

        {/* Document */}
        <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          {/* Header */}
          <div style={{ background: venue.primaryColor, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ color: "white" }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7 }}>{plan.name}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{venue.name}</div>
            </div>
            <div style={{ color: "white", textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{event.name}</div>
              {event.eventDate && (
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  {new Date(event.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>
          </div>

          {/* SVG Canvas */}
          <div style={{ padding: 24 }}>
            <svg
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              style={{ width: "100%", border: "1px solid #DED6CA", borderRadius: 6, background: "#F7F5F1", display: "block" }}
            >
              {/* Background image */}
              {plan.backgroundImageUrl && (
                <image
                  href={plan.backgroundImageUrl}
                  x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
                  opacity={plan.backgroundImageOpacity}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {/* Grid — every 100 units (≈8.3 ft), same spacing as before this plan's room size became configurable */}
              {Array.from({ length: Math.ceil(CANVAS_WIDTH / 100) }, (_, i) => (i + 1) * 100).filter((x) => x < CANVAS_WIDTH).map((x) => (
                <line key={`v${x}`} x1={x} y1={0} x2={x} y2={CANVAS_HEIGHT} stroke="#DED6CA" strokeWidth={0.5} />
              ))}
              {Array.from({ length: Math.ceil(CANVAS_HEIGHT / 100) }, (_, i) => (i + 1) * 100).filter((y) => y < CANVAS_HEIGHT).map((y) => (
                <line key={`h${y}`} x1={0} y1={y} x2={CANVAS_WIDTH} y2={y} stroke="#DED6CA" strokeWidth={0.5} />
              ))}
              {/* Objects */}
              {[...plan.objects].sort((a, b) => a.sortOrder - b.sortOrder).map(renderObject)}
            </svg>
          </div>

          {/* Table legend (round tables with capacity) */}
          {plan.objects.some((o) => o.objectType.startsWith("table") && o.label) && (
            <div style={{ borderTop: "1px solid #DED6CA", padding: "12px 24px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8E978E", marginBottom: 8 }}>Table Guide</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px" }}>
                {plan.objects
                  .filter((o) => o.objectType.startsWith("table") && o.label)
                  .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""))
                  .map((o) => (
                    <span key={o.id} style={{ fontSize: 11, color: "#4F5F4F" }}>
                      {o.label}{o.capacity ? ` (${o.capacity} seats)` : ""}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {plan.notes && (
            <div style={{ borderTop: "1px solid #DED6CA", padding: "12px 24px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8E978E", marginBottom: 6 }}>Notes</div>
              <p style={{ fontSize: 12, color: "#4F5F4F", whiteSpace: "pre-wrap", margin: 0 }}>{plan.notes}</p>
            </div>
          )}

          <div style={{ borderTop: "1px solid #DED6CA", padding: "8px 24px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#B8AEA1" }}>{venue.name}</span>
            <span style={{ fontSize: 10, color: "#B8AEA1" }}>Powered by Wevenu</span>
          </div>
        </div>
      </div>
    </>
  );
}

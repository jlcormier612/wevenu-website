import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PrintButton } from "@/app/(app)/events/[id]/floor-plan-print/print-button";
import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorFloorPlan } from "@/lib/floor-plans/service";
import { OBJECT_STYLE } from "@/lib/floor-plans/constants";
import type { FloorPlanObject } from "@/lib/floor-plans/types";

type Props = {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ from?: string }>;
};

export const metadata: Metadata = { title: "Floor Plan" };

/**
 * Sprint 1 — Vendor Event Assets. A vendor's read-only view of one Floor
 * Plan the venue has explicitly shared with vendors assigned to that event
 * (floor_plans.shared_with_vendors, set from the Booking Floor Plan
 * Workspace's "Share with Vendors" toggle). getVendorFloorPlan re-validates
 * both the share flag and the vendor's own assignment to the event server
 * side — this page never trusts a guessed id.
 *
 * Rendering mirrors app/(app)/events/[id]/floor-plan-print/[planId]/page.tsx
 * exactly (same SVG canvas, same browser print-to-PDF path covers
 * "Download"), scoped to the vendor's own data fetch instead of the
 * coordinator's.
 */
export default async function VendorFloorPlanPage({ params, searchParams }: Props) {
  const { planId } = await params;
  const { from: fromAssignmentId } = await searchParams;
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const plan = await getVendorFloorPlan(planId);
  if (!plan) notFound();

  // Prefer return to the event Documents workspace when opened from there
  // (?from=assignmentId). Fall back to looking up the vendor's assignment
  // for this plan's event; last resort is the events list.
  let backHref = "/vendor/events";
  let backLabel = "← Back to Events";
  if (fromAssignmentId) {
    backHref = `/vendor/events/${fromAssignmentId}?tab=documents`;
    backLabel = "← Back to Documents";
  } else {
    const { getVendorEvents } = await import("@/lib/vendor-events/service");
    const events = await getVendorEvents();
    const match = events.find((e) => e.eventId === plan.eventId);
    if (match) {
      backHref = `/vendor/events/${match.assignmentId}?tab=documents`;
      backLabel = "← Back to Documents";
    }
  }

  const CANVAS_WIDTH = plan.roomWidthFt * 12;
  const CANVAS_HEIGHT = plan.roomDepthFt * 12;

  function renderObject(obj: FloorPlanObject): React.ReactNode {
    const legacyStyle = OBJECT_STYLE[obj.objectType];
    const style = obj.displayShape ? DISPLAY_SHAPE_STYLE[obj.displayShape] : legacyStyle;
    const fill = obj.color ?? style.fill;
    const hw = obj.width / 2;
    const hh = obj.height / 2;
    const fontSize = Math.max(9, Math.min(13, obj.width / 6));
    const transform = `rotate(${obj.rotation}, ${obj.x}, ${obj.y})`;

    return (
      <g key={obj.id} transform={transform}>
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
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <Link href={backHref} style={{ fontSize: 14, color: "#5D6F5D", textDecoration: "none" }}>{backLabel}</Link>
          <PrintButton />
        </div>

        <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ background: plan.venuePrimaryColor ?? "#5D6F5D", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "white" }}>
              {plan.venueLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={plan.venueLogoUrl} alt="" style={{ height: 36, width: 36, borderRadius: 8, objectFit: "contain", background: "rgba(255,255,255,0.15)" }} />
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7 }}>{plan.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{plan.venueName}</div>
              </div>
            </div>
            <div style={{ color: "white", textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.eventName}</div>
              {plan.eventDate && (
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  {new Date(plan.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: 24 }}>
            <svg
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              style={{ width: "100%", border: "1px solid #DED6CA", borderRadius: 6, background: "#F7F5F1", display: "block" }}
            >
              {plan.backgroundImageUrl && (
                <image
                  href={plan.backgroundImageUrl}
                  x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
                  opacity={plan.backgroundImageOpacity}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {Array.from({ length: Math.ceil(CANVAS_WIDTH / 100) }, (_, i) => (i + 1) * 100).filter((x) => x < CANVAS_WIDTH).map((x) => (
                <line key={`v${x}`} x1={x} y1={0} x2={x} y2={CANVAS_HEIGHT} stroke="#DED6CA" strokeWidth={0.5} />
              ))}
              {Array.from({ length: Math.ceil(CANVAS_HEIGHT / 100) }, (_, i) => (i + 1) * 100).filter((y) => y < CANVAS_HEIGHT).map((y) => (
                <line key={`h${y}`} x1={0} y1={y} x2={CANVAS_WIDTH} y2={y} stroke="#DED6CA" strokeWidth={0.5} />
              ))}
              {[...plan.objects].sort((a, b) => a.sortOrder - b.sortOrder).map(renderObject)}
            </svg>
          </div>

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

          {plan.notes && (
            <div style={{ borderTop: "1px solid #DED6CA", padding: "12px 24px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8E978E", marginBottom: 6 }}>Notes</div>
              <p style={{ fontSize: 12, color: "#4F5F4F", whiteSpace: "pre-wrap", margin: 0 }}>{plan.notes}</p>
            </div>
          )}

          <div style={{ borderTop: "1px solid #DED6CA", padding: "8px 24px" }}>
            <span style={{ fontSize: 10, color: "#B8AEA1" }}>{plan.venueName}</span>
          </div>
        </div>
      </div>
    </>
  );
}

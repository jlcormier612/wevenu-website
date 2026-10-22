"use client";

import * as React from "react";
import Link from "next/link";

import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { Badge } from "@/components/ui/badge";
import { OBJECT_STYLE } from "@/lib/floor-plans/constants";
import type { DisplayShape, ObjectType } from "@/lib/floor-plans/types";
import type { PortalPreviewData, PreviewVisibility } from "@/lib/client-portal-preview/load-preview";
import type { PortalFloorPlanObject } from "@/lib/portal/types";

function visibilityBadge(visibility: PreviewVisibility): { label: string; variant: "success" | "secondary" | "outline" } {
  if (visibility === "released") return { label: "Visible to client", variant: "success" };
  if (visibility === "draft") return { label: "Preview — not yet released", variant: "secondary" };
  return { label: "Not included", variant: "outline" };
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatOptionalMoney(n: number | null): string {
  if (n == null) return "—";
  return formatMoney(n);
}

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
        className="mx-auto block h-auto w-full max-h-[50vh]"
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

function SectionChrome({
  title,
  visibility,
  children,
  testId,
}: {
  title: string;
  visibility: PreviewVisibility;
  children: React.ReactNode;
  testId: string;
}) {
  const badge = visibilityBadge(visibility);
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-heading">{title}</h2>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      {visibility === "not_included" ? (
        <p className="text-sm text-muted-foreground">Not included for this event&apos;s client experience.</p>
      ) : (
        children
      )}
    </section>
  );
}

export function ClientPortalPreview({ data }: { data: PortalPreviewData }) {
  const [tab, setTab] = React.useState<"planning" | "event-order" | "floor-plans" | "inventory" | "vendors">("event-order");

  const eoSectionKeys = [...new Set(data.eventOrder.lines.map((l) => l.sectionId))];

  return (
    <div className="min-h-screen bg-[#F7F5F1]" data-testid="client-portal-preview">
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Client portal preview
            </p>
            <p className="text-sm font-semibold text-heading">
              {data.coupleName} · {data.eventName}
            </p>
            <p className="text-xs text-muted-foreground">
              Read-only view of this event. Does not release, invite, or change anything.
            </p>
          </div>
          <Link
            href={data.returnHref}
            data-testid="portal-preview-back"
            className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back to booking
          </Link>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3">
          {(
            [
              ["event-order", "Event Order"],
              ["floor-plans", "Floor Plans"],
              ["planning", "Planning"],
              ["inventory", "Inventory"],
              ["vendors", "Vendors"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`portal-preview-tab-${id}`}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {tab === "event-order" ? (
          <SectionChrome title="What you're receiving" visibility={data.eventOrder.visibility} testId="portal-preview-event-order">
            {data.eventOrder.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delivery items on this Event Order yet.</p>
            ) : (
              <div className="space-y-4">
                {eoSectionKeys.map((sectionId) => {
                  const lines = data.eventOrder.lines.filter((l) => l.sectionId === sectionId);
                  const sectionName = lines[0]?.sectionName;
                  return (
                    <div key={sectionId ?? "general"} className="space-y-2">
                      {sectionName && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {sectionName}
                        </p>
                      )}
                      <div className="divide-y divide-border rounded-xl border border-border bg-card">
                        {lines.map((l) => (
                          <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm text-foreground">{l.description}</p>
                              <p className="text-xs text-muted-foreground">
                                ×{l.quantity}{l.unit ? ` ${l.unit}` : ""}
                                {" · "}
                                {l.isIncluded === false ? "Additional" : "Included"}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-medium text-foreground">
                              {formatOptionalMoney(l.unitPrice == null ? null : l.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionChrome>
        ) : null}

        {tab === "floor-plans" ? (
          <SectionChrome title="Floor Plans" visibility={data.floorPlans.visibility} testId="portal-preview-floor-plans">
            {data.floorPlans.offerCount > 1 ? (
              <p className="text-xs text-muted-foreground">
                {data.floorPlans.offerCount} layout options are offered. Showing the working/operational layout
                {data.floorPlans.coupleSelectedFloorPlanId ? " (or couple selection when set)" : ""}.
              </p>
            ) : null}
            {data.floorPlans.plan ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-heading">{data.floorPlans.plan.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {data.floorPlans.plan.sharedWithCouple
                      ? "Shared with couple"
                      : "Working layout — Preview — not yet released"}
                  </p>
                </div>
                <LayoutPreviewSvg
                  planName={data.floorPlans.plan.name}
                  roomWidthFt={data.floorPlans.plan.roomWidthFt}
                  roomDepthFt={data.floorPlans.plan.roomDepthFt}
                  backgroundImageUrl={data.floorPlans.plan.backgroundImageUrl}
                  backgroundImageOpacity={data.floorPlans.plan.backgroundImageOpacity}
                  objects={data.floorPlans.plan.objects}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No operational floor plan on this event yet.</p>
            )}
          </SectionChrome>
        ) : null}

        {tab === "planning" ? (
          <SectionChrome title="Your planning checklist" visibility={data.planning.visibility} testId="portal-preview-planning">
            {data.planning.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No client planning tasks on this event yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {data.planning.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-foreground">{t.title}</span>
                    <span className="text-xs text-muted-foreground">{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Venue/internal planning checklists are never shown here.
            </p>
          </SectionChrome>
        ) : null}

        {tab === "inventory" ? (
          <SectionChrome title="Inventory" visibility={data.inventory.visibility} testId="portal-preview-inventory">
            {data.inventory.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inventory items on this event yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {data.inventory.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      {i.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ×{i.quantity} · {i.isIncluded ? "Included" : "Additional"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionChrome>
        ) : null}

        {tab === "vendors" ? (
          <SectionChrome title="Vendor highlights" visibility={data.vendors.visibility} testId="portal-preview-vendors">
            {data.vendors.highlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vendor highlights for this event yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {data.vendors.highlights.map((v) => (
                  <li key={v.id} className="px-4 py-3 text-sm">
                    <p className="font-medium text-foreground">{v.name}</p>
                    {v.category ? <p className="text-xs text-muted-foreground">{v.category}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionChrome>
        ) : null}

        <p className="text-center text-xs text-muted-foreground" data-testid="portal-preview-safety-note">
          Preview only · {data.venueName} · No release, invite, email, invoice, or Library changes
        </p>
      </div>
    </div>
  );
}

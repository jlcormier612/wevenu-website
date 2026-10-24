"use client";

import * as React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { FloorPlanPortalView } from "@/components/portal/floor-plan-view";
import { PlanningTasksPortalView } from "@/components/portal/planning-tasks-view";
import { TimelinePortalPreviewView } from "@/components/portal/timeline-preview-view";
import { VendorsPortalPreviewView } from "@/components/portal/vendors-preview-view";
import type { PortalPreviewData, PreviewVisibility } from "@/lib/client-portal-preview/load-preview";
import { PUBLIC_FORM_LIGHT_VARS } from "@/lib/theme/public-form-surface";

/** Exact Client Portal Preview nav — Event Setup planning experience only. */
export const CLIENT_PORTAL_PREVIEW_TABS = [
  ["planning", "Planning"],
  ["timeline", "Timeline"],
  ["floor-plans", "Floor Plans"],
  ["vendors", "Vendors"],
] as const;

export type ClientPortalPreviewTab = (typeof CLIENT_PORTAL_PREVIEW_TABS)[number][0];

function visibilityBadge(visibility: PreviewVisibility): {
  label: string;
  variant: "success" | "secondary" | "outline";
} {
  if (visibility === "released") return { label: "Visible to client", variant: "success" };
  if (visibility === "draft") return { label: "Preview — not yet released", variant: "secondary" };
  return { label: "Not included", variant: "outline" };
}

export function ClientPortalPreview({ data }: { data: PortalPreviewData }) {
  const [tab, setTab] = React.useState<ClientPortalPreviewTab>("planning");

  // Staff app may be in dark mode; couple portal is always a light surface.
  // Hardcoding cream without re-pinning light tokens made text-heading /
  // muted-foreground resolve to dark-theme white → illegible on cream.
  const previewSurfaceStyle = {
    ...PUBLIC_FORM_LIGHT_VARS,
    color: "var(--foreground)",
    colorScheme: "light",
    backgroundColor: "var(--natural-cream)",
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen text-foreground"
      style={previewSurfaceStyle}
      data-theme-lock="light"
      data-testid="client-portal-preview"
    >
      {/* Venue-side framing only — outside the simulated couple page chrome */}
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
          {CLIENT_PORTAL_PREVIEW_TABS.map(([id, label]) => (
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
        {tab === "planning" ? (
          <section data-testid="portal-preview-planning" className="space-y-4">
            <div className="flex justify-end px-4">
              <Badge variant={visibilityBadge(data.planning.visibility).variant}>
                {visibilityBadge(data.planning.visibility).label}
              </Badge>
            </div>
            <PlanningTasksPortalView
              tasks={data.planning.released ? data.planning.tasks : []}
              venueName={data.venueName}
              released={data.planning.released}
            />
            {!data.planning.released && data.planning.tasks.length > 0 ? (
              <div className="border-t border-dashed border-border pt-4 space-y-2">
                <p className="px-4 text-xs text-muted-foreground">
                  Staff draft below — couple planning is not released yet. Venue/internal tasks are never shown.
                </p>
                <PlanningTasksPortalView
                  tasks={data.planning.tasks}
                  venueName={data.venueName}
                  released
                  staffPreviewLabel="Preview — not yet released"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "timeline" ? (
          <section data-testid="portal-preview-timeline" className="space-y-4">
            <div className="flex justify-end px-4">
              <Badge variant={visibilityBadge(data.timeline.visibility).variant}>
                {visibilityBadge(data.timeline.visibility).label}
              </Badge>
            </div>
            <TimelinePortalPreviewView
              entries={data.timeline.clientVisible}
              venueName={data.venueName}
              eventDate={data.eventDate}
              eventEndDate={data.eventEndDate}
            />
            {data.timeline.staffDraft.length > 0 ? (
              <div className="border-t border-dashed border-border pt-4 space-y-2">
                <p className="px-4 text-xs text-muted-foreground">
                  Staff draft below — not visible to the couple until you share the Timeline.
                </p>
                <TimelinePortalPreviewView
                  entries={data.timeline.staffDraft}
                  venueName={data.venueName}
                  eventDate={data.eventDate}
                  eventEndDate={data.eventEndDate}
                  staffPreviewLabel="Preview — not yet released"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "floor-plans" ? (
          <section data-testid="portal-preview-floor-plans" className="space-y-2">
            <div className="flex justify-end px-4">
              <Badge variant={visibilityBadge(data.floorPlans.visibility).variant}>
                {visibilityBadge(data.floorPlans.visibility).label}
              </Badge>
            </div>
            <FloorPlanPortalView
              data={data.floorPlans.view}
              staffPreviewLabel={
                data.floorPlans.visibility === "draft"
                  ? "Layout offers are visible for choosing; shared Floor Plan view appears after the venue shares a plan."
                  : null
              }
            />
          </section>
        ) : null}

        {tab === "vendors" ? (
          <section data-testid="portal-preview-vendors" className="space-y-2">
            <div className="flex justify-end px-4">
              <Badge
                variant={visibilityBadge(data.vendors.visibility).variant}
                data-testid="portal-preview-vendors-badge"
              >
                {data.vendors.recommendations.length > 0
                  ? "Recommendations — not the assigned roster"
                  : visibilityBadge(data.vendors.visibility).label}
              </Badge>
            </div>
            <VendorsPortalPreviewView
              recommendations={data.vendors.recommendations}
              venueName={data.venueName}
            />
          </section>
        ) : null}

        <p className="text-center text-xs text-muted-foreground" data-testid="portal-preview-safety-note">
          Preview only · {data.venueName} · No release, invite, email, invoice, or Library changes
        </p>
      </div>
    </div>
  );
}

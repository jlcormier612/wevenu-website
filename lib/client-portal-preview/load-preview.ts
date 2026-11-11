/**
 * Staff read-only client portal preview — portal-faithful payloads.
 * Does not invite, release, share, ensure recommendations, or mutate.
 * Preview sections match Event Setup client planning experience only
 * (Planning, Timeline, Floor Plans, Vendors) — not commercial Inventory/EO.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getEvent } from "@/lib/events/service";
import { getFloorPlan, getFloorPlansByEvent } from "@/lib/floor-plans/service";
import { getEventFloorPlanOffers } from "@/lib/floor-plan-offers/service";
import { getObjects as getTemplateObjects, getTemplate } from "@/lib/floor-plan-templates/service";
import { getEventRecommendations } from "@/lib/vendor-recommendations/service";
import { getCurrentVenue } from "@/lib/venue/service";
import type { FloorPlanPortalViewModel } from "@/components/portal/floor-plan-view";
import type { PlanningTaskPreviewItem } from "@/components/portal/planning-tasks-view";
import type { TimelinePreviewEntry } from "@/components/portal/timeline-preview-view";
import type { VendorPreviewCard } from "@/components/portal/vendors-preview-view";
import type { PortalFloorPlanDetail, PortalFloorPlanObject } from "@/lib/portal/types";
import {
  computeVenueTimelineClientShareStatus,
  venueItemVisibleToClient,
} from "@/lib/timeline/audience-ownership";
import * as timelineRepo from "@/lib/timeline/repository";

export type PreviewVisibility = "released" | "draft" | "not_included";

export type PortalPreviewData = {
  eventId: string;
  clientId: string;
  eventName: string;
  coupleName: string;
  venueName: string;
  returnHref: string;
  eventDate: string | null;
  eventEndDate: string | null;
  planning: {
    visibility: PreviewVisibility;
    released: boolean;
    tasks: PlanningTaskPreviewItem[];
  };
  timeline: {
    visibility: PreviewVisibility;
    clientVisible: TimelinePreviewEntry[];
    staffDraft: TimelinePreviewEntry[];
  };
  floorPlans: {
    visibility: PreviewVisibility;
    view: FloorPlanPortalViewModel;
  };
  vendors: {
    visibility: PreviewVisibility;
    recommendations: VendorPreviewCard[];
  };
};

function toPortalObjects(
  objects: Array<{
    id: string;
    objectType: string;
    label: string | null;
    capacity?: number | null;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    sortOrder?: number;
    color: string | null;
    notes?: string | null;
    displayShape: string | null;
    inventoryItemId?: string | null;
  }>,
): PortalFloorPlanObject[] {
  return objects.map((o, i) => ({
    id: o.id,
    objectType: o.objectType,
    label: o.label,
    capacity: o.capacity ?? null,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    rotation: o.rotation,
    sortOrder: o.sortOrder ?? i,
    color: o.color,
    notes: o.notes ?? null,
    displayShape: o.displayShape,
    inventoryItemId: o.inventoryItemId ?? null,
  }));
}

function toPreviewEntry(
  e: {
    id: string;
    title: string;
    description: string | null;
    entryTime: string | null;
    dayOffset: number;
    sectionId: string | null;
    sortOrder: number;
    owner: "venue" | "client";
  },
  sectionNameById: Map<string, string>,
): TimelinePreviewEntry {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    entryTime: e.entryTime,
    dayOffset: Number(e.dayOffset ?? 0) || 0,
    sectionId: e.sectionId,
    sectionName: e.sectionId ? sectionNameById.get(e.sectionId) ?? null : null,
    sortOrder: e.sortOrder,
    owner: e.owner,
  };
}

export async function loadClientPortalPreview(
  clientId: string,
  eventId: string,
): Promise<PortalPreviewData | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const event = await getEvent(eventId);
  if (!event || event.clientId !== clientId || event.venueId !== venue.id) return null;

  const supabase = await createClient();

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, first_name, last_name, partner_first_name, partner_last_name")
    .eq("id", clientId)
    .eq("venue_id", venue.id)
    .maybeSingle<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      partner_first_name: string | null;
      partner_last_name: string | null;
    }>();
  if (!clientRow) return null;

  const coupleParts = [
    [clientRow.first_name, clientRow.last_name].filter(Boolean).join(" "),
    [clientRow.partner_first_name, clientRow.partner_last_name].filter(Boolean).join(" "),
  ].filter(Boolean);
  const coupleName = coupleParts.join(" & ") || "Client";

  const { data: clientApp } = await supabase
    .from("event_playbook_applications")
    .select("id, released_at")
    .eq("event_id", eventId)
    .eq("venue_id", venue.id)
    .eq("kind", "client")
    .maybeSingle<{ id: string; released_at: string | null }>();

  const { data: coupleTaskRows } = await supabase
    .from("event_tasks")
    .select(
      "id, title, description, status, due_date, days_offset, due_date_locked, milestone_name, is_required",
    )
    .eq("event_id", eventId)
    .eq("venue_id", venue.id)
    .eq("owner_type", "couple")
    .in("visibility", ["client_visible", "client_owned"])
    .order("sort_order", { ascending: true })
    .limit(80);

  const planningReleased = Boolean(clientApp?.released_at);
  const planningVisibility: PreviewVisibility = !clientApp
    ? "not_included"
    : planningReleased
      ? "released"
      : "draft";

  const planningTasks: PlanningTaskPreviewItem[] = (coupleTaskRows ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    dueDate: t.due_date,
    daysOffset: t.days_offset,
    dueDateLocked: Boolean(t.due_date_locked),
    milestoneName: t.milestone_name,
    isRequired: Boolean(t.is_required),
  }));

  // Read-only — do not call getTimelineEntries (that syncs/mutates schedule rows).
  const [timelineEntries, timelineSections] = await Promise.all([
    timelineRepo.getTimelineEntries(supabase, venue.id, eventId),
    timelineRepo.getSections(supabase, venue.id, eventId),
  ]);
  const sectionNameById = new Map(timelineSections.map((s) => [s.id, s.name]));
  const shareStatus = computeVenueTimelineClientShareStatus(timelineEntries);
  const clientVisibleEntries = timelineEntries
    .filter((e) => e.owner === "client" || venueItemVisibleToClient(e.audiences))
    .map((e) => toPreviewEntry(e, sectionNameById));
  const staffDraftEntries =
    shareStatus.kind === "not_shared" || shareStatus.kind === "partial"
      ? timelineEntries
          .filter((e) => e.owner === "venue" && !venueItemVisibleToClient(e.audiences))
          .map((e) => toPreviewEntry(e, sectionNameById))
      : [];
  const timelineVisibility: PreviewVisibility =
    shareStatus.kind === "empty"
      ? "not_included"
      : shareStatus.kind === "not_shared"
        ? "draft"
        : "released";

  const plans = await getFloorPlansByEvent(eventId);
  const offers = await getEventFloorPlanOffers(eventId);
  const sharedPlans = plans.filter((p) => p.sharedWithCouple);
  const operationalId = event.operationalFloorPlanId ?? null;

  const detailsById: FloorPlanPortalViewModel["detailsById"] = {};
  for (const p of sharedPlans) {
    const detail = await getFloorPlan(p.id);
    if (!detail) continue;
    detailsById[p.id] = {
      plan: {
        id: detail.id,
        name: detail.name,
        roomWidthFt: Number(detail.roomWidthFt) || 0,
        roomDepthFt: Number(detail.roomDepthFt) || 0,
        backgroundImageUrl: detail.backgroundImageUrl ?? null,
        backgroundImageOpacity: Number(detail.backgroundImageOpacity ?? 0.25),
        notes: detail.notes ?? null,
        isOperational: operationalId === detail.id,
        spaceId: detail.spaceId ?? null,
        measurementUnit: detail.measurementUnit ?? "ft",
      },
      objects: toPortalObjects(detail.objects ?? []),
    } satisfies PortalFloorPlanDetail;
  }

  const offerPreviewsById: NonNullable<FloorPlanPortalViewModel["offerPreviewsById"]> = {};
  const offered = offers.filter((o) => o.isOffered !== false);
  for (const o of offered) {
    const template = await getTemplate(o.floorPlanTemplateId);
    if (!template) continue;
    const objs = await getTemplateObjects(o.floorPlanTemplateId);
    offerPreviewsById[o.id] = {
      name: o.coupleLabel?.trim() || o.templateName || template.name,
      roomWidthFt: Number(template.roomWidthFt) || 0,
      roomDepthFt: Number(template.roomDepthFt) || 0,
      backgroundImageUrl: template.backgroundImageUrl ?? null,
      backgroundImageOpacity: Number(template.backgroundImageOpacity ?? 0.25),
      objects: toPortalObjects(objs),
    };
  }

  const fpVisibility: PreviewVisibility =
    sharedPlans.length > 0
      ? "released"
      : offered.length > 0
        ? "draft"
        : "not_included";

  const floorView: FloorPlanPortalViewModel = {
    list: sharedPlans.map((p) => ({
      id: p.id,
      name: p.name,
      isOperational: operationalId === p.id,
      spaceId: p.spaceId ?? null,
      createdAt: p.createdAt,
    })),
    offers: offered.map((o) => ({
      offerId: o.id,
      templateId: o.floorPlanTemplateId,
      name: o.coupleLabel?.trim() || o.templateName,
      blurb: o.coupleBlurb ?? null,
      spaceId: o.templateSpaceId ?? null,
      sortOrder: o.sortOrder,
      objectCount: o.objectCount ?? 0,
      isCurrentSelection: Boolean(
        event.coupleSelectedFloorPlanId
        && sharedPlans.some(
          (p) => p.id === event.coupleSelectedFloorPlanId && p.sourceTemplateId === o.floorPlanTemplateId,
        ),
      ),
      roomWidthFt: Number(offerPreviewsById[o.id]?.roomWidthFt ?? 0),
      roomDepthFt: Number(offerPreviewsById[o.id]?.roomDepthFt ?? 0),
    })),
    operationalFloorPlanId: operationalId,
    detailsById,
    offerPreviewsById,
  };

  // Read-only — never getOrEnsure (would seed Network → event recommendations).
  const recs = await getEventRecommendations(eventId);
  const vendorIds = [...new Set(recs.map((r) => r.vendorId).filter(Boolean))];
  const vendorDirectory = new Map<
    string,
    { description: string | null; photoUrl: string | null; websiteUrl: string | null; name: string | null; category: string | null }
  >();
  if (vendorIds.length > 0) {
    const { data: vendorRows } = await supabase
      .from("vendors")
      .select("id, business_name, category, description, logo_url, website_url")
      .in("id", vendorIds);
    for (const v of vendorRows ?? []) {
      vendorDirectory.set(v.id as string, {
        name: (v.business_name as string | null) ?? null,
        category: (v.category as string | null) ?? null,
        description: (v.description as string | null) ?? null,
        photoUrl: (v.logo_url as string | null) ?? null,
        websiteUrl: (v.website_url as string | null) ?? null,
      });
    }
  }
  const vendorCards: VendorPreviewCard[] = recs.map((r) => {
    const dir = vendorDirectory.get(r.vendorId);
    return {
      id: r.id,
      vendorId: r.vendorId,
      name: dir?.name || r.vendorName || "Vendor",
      category: dir?.category ?? r.vendorCategory ?? null,
      description: dir?.description ?? null,
      photoUrl: dir?.photoUrl ?? null,
      websiteUrl: dir?.websiteUrl ?? null,
      note: r.note ?? null,
    };
  });
  const vendorVisibility: PreviewVisibility =
    vendorCards.length > 0 ? "released" : "not_included";

  return {
    eventId,
    clientId,
    eventName: event.name || "Event",
    coupleName,
    venueName: venue.name,
    returnHref: `/clients/${clientId}`,
    eventDate: event.eventDate ?? null,
    eventEndDate: event.eventEndDate ?? null,
    planning: {
      visibility: planningVisibility,
      released: planningReleased,
      tasks: planningTasks,
    },
    timeline: {
      visibility: timelineVisibility,
      clientVisible: clientVisibleEntries,
      staffDraft: staffDraftEntries,
    },
    floorPlans: {
      visibility: fpVisibility,
      view: floorView,
    },
    vendors: {
      visibility: vendorVisibility,
      recommendations: vendorCards,
    },
  };
}

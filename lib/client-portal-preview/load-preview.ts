/**
 * Staff read-only client portal preview — same event-scoped materials the
 * couple will see, without portal token auth, release, invite, or mutation.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getEventOrder } from "@/lib/event-orders/service";
import { getEvent } from "@/lib/events/service";
import { getFloorPlan, getFloorPlansByEvent } from "@/lib/floor-plans/service";
import { getEventInventory } from "@/lib/event-inventory/service";
import { getEventFloorPlanOffers } from "@/lib/floor-plan-offers/service";
import { getCurrentVenue } from "@/lib/venue/service";
import type { PortalFloorPlanObject } from "@/lib/portal/types";

export type PreviewVisibility = "released" | "draft" | "not_included";

export type PortalPreviewEventOrderLine = {
  id: string;
  description: string;
  quantity: number;
  amount: number;
  sectionId: string | null;
  sectionName: string | null;
  isIncluded: boolean;
  unit: string | null;
  unitPrice: number | null;
  notes: string | null;
};

export type PortalPreviewData = {
  eventId: string;
  clientId: string;
  eventName: string;
  coupleName: string;
  venueName: string;
  returnHref: string;
  planning: {
    visibility: PreviewVisibility;
    tasks: Array<{ id: string; title: string; status: string }>;
  };
  eventOrder: {
    visibility: PreviewVisibility;
    sharedAt: string | null;
    lines: PortalPreviewEventOrderLine[];
  };
  inventory: {
    visibility: PreviewVisibility;
    items: Array<{ id: string; name: string; quantity: number; isIncluded: boolean }>;
  };
  floorPlans: {
    visibility: PreviewVisibility;
    operationalFloorPlanId: string | null;
    coupleSelectedFloorPlanId: string | null;
    offerCount: number;
    plan: {
      id: string;
      name: string;
      roomWidthFt: number;
      roomDepthFt: number;
      backgroundImageUrl: string | null;
      backgroundImageOpacity: number | null;
      objects: PortalFloorPlanObject[];
      sharedWithCouple: boolean;
    } | null;
  };
  vendors: {
    visibility: PreviewVisibility;
    highlights: Array<{ id: string; name: string; category: string | null }>;
  };
};

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

  const { data: coupleTasks } = await supabase
    .from("event_tasks")
    .select("id, title, status")
    .eq("event_id", eventId)
    .eq("venue_id", venue.id)
    .eq("owner_type", "couple")
    .order("sort_order", { ascending: true })
    .limit(80);

  const planningVisibility: PreviewVisibility = !clientApp
    ? "not_included"
    : clientApp.released_at
      ? "released"
      : "draft";

  const eventOrder = await getEventOrder(eventId);
  const sectionNameById = new Map((eventOrder?.sections ?? []).map((s) => [s.id, s.name]));
  const eoLines: PortalPreviewEventOrderLine[] = (eventOrder?.lines ?? []).map((l) => ({
    id: l.id,
    description: l.description,
    quantity: l.quantity,
    amount: l.amount,
    sectionId: l.sectionId,
    sectionName: l.sectionId ? sectionNameById.get(l.sectionId) ?? null : null,
    isIncluded: l.isIncluded,
    unit: l.unit,
    unitPrice: l.unitPrice,
    notes: l.notes,
  }));
  const eoVisibility: PreviewVisibility = !eventOrder
    ? "not_included"
    : eventOrder.sharedAt
      ? "released"
      : "draft";

  const inventory = await getEventInventory(eventId);
  const invVisibility: PreviewVisibility = !inventory
    ? "not_included"
    : inventory.status === "shared" || inventory.status === "finalized"
      ? "released"
      : "draft";

  const plans = await getFloorPlansByEvent(eventId);
  const offers = await getEventFloorPlanOffers(eventId);
  const operationalId = event.operationalFloorPlanId ?? null;
  const coupleSelectedId = event.coupleSelectedFloorPlanId ?? null;
  const workingId = operationalId
    ?? coupleSelectedId
    ?? plans.find((p) => p.sharedWithCouple)?.id
    ?? plans[0]?.id
    ?? null;
  const workingDetail = workingId ? await getFloorPlan(workingId) : null;
  const sharedAny = plans.some((p) => p.sharedWithCouple) || (offers?.length ?? 0) > 0;
  const fpVisibility: PreviewVisibility = workingDetail
    ? (workingDetail.sharedWithCouple || sharedAny ? "released" : "draft")
    : offers.length > 0
      ? "draft"
      : "not_included";

  const { data: highlights } = await supabase
    .from("event_vendor_recommendations")
    .select("id, vendor_id, vendors(name, category)")
    .eq("event_id", eventId)
    .eq("venue_id", venue.id)
    .limit(40);

  const vendorRows = (highlights ?? []).map((row: {
    id: string;
    vendors: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
  }) => {
    const v = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    return {
      id: row.id,
      name: v?.name ?? "Vendor",
      category: v?.category ?? null,
    };
  });

  return {
    eventId,
    clientId,
    eventName: event.name || "Event",
    coupleName,
    venueName: venue.name,
    returnHref: `/clients/${clientId}`,
    planning: {
      visibility: planningVisibility,
      tasks: (coupleTasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
      })),
    },
    eventOrder: {
      visibility: eoVisibility,
      sharedAt: eventOrder?.sharedAt ?? null,
      lines: eoLines,
    },
    inventory: {
      visibility: invVisibility,
      items: (inventory?.items ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        isIncluded: i.isIncluded,
      })),
    },
    floorPlans: {
      visibility: fpVisibility,
      operationalFloorPlanId: operationalId,
      coupleSelectedFloorPlanId: coupleSelectedId,
      offerCount: offers.length,
      plan: workingDetail
        ? {
            id: workingDetail.id,
            name: workingDetail.name,
            roomWidthFt: Number(workingDetail.roomWidthFt) || 0,
            roomDepthFt: Number(workingDetail.roomDepthFt) || 0,
            backgroundImageUrl: workingDetail.backgroundImageUrl ?? null,
            backgroundImageOpacity: workingDetail.backgroundImageOpacity ?? null,
            sharedWithCouple: workingDetail.sharedWithCouple,
            objects: (workingDetail.objects ?? []).map((o): PortalFloorPlanObject => ({
              id: o.id,
              objectType: o.objectType,
              label: o.label,
              capacity: o.capacity ?? null,
              x: o.x,
              y: o.y,
              width: o.width,
              height: o.height,
              rotation: o.rotation,
              sortOrder: o.sortOrder,
              color: o.color,
              notes: o.notes ?? null,
              displayShape: o.displayShape,
              inventoryItemId: o.inventoryItemId ?? null,
            })),
          }
        : null,
    },
    vendors: {
      visibility: vendorRows.length > 0 ? "draft" : "not_included",
      highlights: vendorRows,
    },
  };
}

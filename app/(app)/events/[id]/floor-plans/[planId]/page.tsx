import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { FloorPlanEditor } from "@/components/floor-plan/floor-plan-editor";
import { FloorPlanFinalizeControl } from "@/components/floor-plan/floor-plan-finalize-control";
import { FloorPlanReconciliationBanner } from "@/components/floor-plan/floor-plan-reconciliation-banner";
import { getEvent } from "@/lib/events/service";
import { canEditFloorPlans } from "@/lib/floor-plans/authorize";
import { getFloorPlan, getFloorPlanReconciliation } from "@/lib/floor-plans/service";
import { getCategories, getFloorPlanEligibleItems, getUsageForEvent } from "@/lib/inventory/service";
import { getCurrentUserRole } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string; planId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { planId } = await params;
  const plan = await getFloorPlan(planId);
  return { title: plan ? `${plan.name} — Floor Plan` : "Floor Plan" };
}

/**
 * One floor plan's editor, reached from the booking's Floor Plans workspace
 * (Booking Floor Plan Workspace task) — a booking may hold many of these.
 * Reuses the existing Floor Plan editor unmodified; its default booking-mode
 * actions already operate on a specific plan id, not "the event's one plan".
 */
export default async function FloorPlanEditorPage({ params }: Props) {
  const { id, planId } = await params;
  const [event, plan, inventoryItems, inventoryCategories, inventoryUsage, reconciliation, role] = await Promise.all([
    getEvent(id), getFloorPlan(planId), getFloorPlanEligibleItems(), getCategories(), getUsageForEvent(id),
    getFloorPlanReconciliation(planId), getCurrentUserRole(),
  ]);
  if (!event || !plan || plan.eventId !== id) notFound();
  const canEdit = canEditFloorPlans(role);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <BusinessAssetHeader
        backHref={event.clientId ? `/clients/${event.clientId}#floorplan` : "/events"}
        backLabel="Floor Plans"
        whatIsThis="Floor Plan"
        title={plan.name}
        status={null}
        lastUpdated={new Date(plan.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        relationship={event.clientId ? { name: event.name, href: `/clients/${event.clientId}` } : { name: event.name }}
        primaryAction={canEdit ? <FloorPlanFinalizeControl planId={plan.id} eventId={event.id} finalizedAt={plan.finalizedAt} /> : null}
      />
      <FloorPlanReconciliationBanner reconciliation={reconciliation} />
      <FloorPlanEditor
        initialPlan={plan}
        eventId={event.id}
        eventName={event.name}
        venueId={event.venueId}
        inventoryItems={inventoryItems}
        inventoryCategories={inventoryCategories}
        inventoryUsage={inventoryUsage}
        readOnly={!canEdit}
      />
    </div>
  );
}

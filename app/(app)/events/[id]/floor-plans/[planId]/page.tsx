import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FloorPlanEditor } from "@/components/floor-plan/floor-plan-editor";
import { FloorPlanFinalizeControl } from "@/components/floor-plan/floor-plan-finalize-control";
import { FloorPlanReconciliationBanner } from "@/components/floor-plan/floor-plan-reconciliation-banner";
import { getEvent } from "@/lib/events/service";
import { getFloorPlan, getFloorPlanReconciliation } from "@/lib/floor-plans/service";
import { getCategories, getFloorPlanEligibleItems, getUsageForEvent } from "@/lib/inventory/service";

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
  const [event, plan, inventoryItems, inventoryCategories, inventoryUsage, reconciliation] = await Promise.all([
    getEvent(id), getFloorPlan(planId), getFloorPlanEligibleItems(), getCategories(), getUsageForEvent(id),
    getFloorPlanReconciliation(planId),
  ]);
  if (!event || !plan || plan.eventId !== id) notFound();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={event.clientId ? `/clients/${event.clientId}#floorplan` : "/events"}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Floor Plans
          </Link>
          <h1 className="font-heading text-2xl font-medium text-heading">{plan.name}</h1>
          <p className="text-sm text-muted-foreground">{event.name}</p>
        </div>
        <FloorPlanFinalizeControl planId={plan.id} eventId={event.id} finalizedAt={plan.finalizedAt} />
      </div>
      <FloorPlanReconciliationBanner reconciliation={reconciliation} />
      <FloorPlanEditor
        initialPlan={plan}
        eventId={event.id}
        eventName={event.name}
        venueId={event.venueId}
        inventoryItems={inventoryItems}
        inventoryCategories={inventoryCategories}
        inventoryUsage={inventoryUsage}
      />
    </div>
  );
}

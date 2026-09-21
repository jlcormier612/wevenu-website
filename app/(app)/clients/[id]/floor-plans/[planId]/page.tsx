import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { FloorPlanEditor } from "@/components/floor-plan/floor-plan-editor";
import { getSpaces } from "@/lib/availability/service";
import { getClient } from "@/lib/clients/service";
import { clientDisplayName } from "@/lib/clients/constants";
import { canEditFloorPlans } from "@/lib/floor-plans/authorize";
import { getFloorPlan } from "@/lib/floor-plans/service";
import { getCategories, getFloorPlanEligibleItems } from "@/lib/inventory/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string; planId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { planId } = await params;
  const plan = await getFloorPlan(planId);
  return { title: plan ? `${plan.name} — Floor Plan` : "Floor Plan" };
}

/** Same floor-plan editor, owned by the client before an Event exists. */
export default async function ClientFloorPlanEditorPage({ params }: Props) {
  const { id, planId } = await params;
  const [client, plan, inventoryItems, inventoryCategories, role, spaces, venue] = await Promise.all([
    getClient(id),
    getFloorPlan(planId),
    getFloorPlanEligibleItems(),
    getCategories(),
    getCurrentUserRole(),
    getSpaces(),
    getCurrentVenue(),
  ]);
  if (!client || !plan || plan.clientId !== id || plan.eventId) notFound();
  const canEdit = canEditFloorPlans(role);
  const planSpace = spaces.find((s) => s.id === plan.spaceId) ?? null;
  const name = clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <BusinessAssetHeader
        backHref={`/clients/${id}#floorplan`}
        backLabel="Floor Plans"
        whatIsThis="Floor Plan"
        title={plan.name}
        status={null}
        lastUpdated={new Date(plan.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        relationship={{ name, href: `/clients/${id}` }}
        primaryAction={null}
      />
      <p className="text-sm text-muted-foreground">
        This floor plan is part of the client's preparation. It does not reserve a date.
      </p>
      <FloorPlanEditor
        initialPlan={plan}
        planningClientId={id}
        eventName={name}
        venueId={venue?.id ?? plan.venueId}
        spaceCapacity={planSpace?.capacity ?? null}
        spaceName={planSpace?.name ?? null}
        inventoryItems={inventoryItems}
        inventoryCategories={inventoryCategories}
        inventoryUsage={[]}
        readOnly={!canEdit}
        showPrint={false}
      />
    </div>
  );
}

import type { Metadata } from "next";

import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { SetupProfilesSection } from "@/components/settings/setup-profiles-section";
import { applicableSetupSteps } from "@/lib/event-setup/state";
import { listVenueSetupProfiles } from "@/lib/event-setup/profiles";
import { buildSetupProfileUsedForOptions } from "@/lib/event-setup/setup-profile-event-types";
import { capabilitiesFromVenue } from "@/lib/playbooks/capabilities";
import { getTemplates as getPlaybookTemplates } from "@/lib/playbooks/service";
import { getTemplates as getTimelineTemplates } from "@/lib/timeline-templates/service";
import { getTemplates as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getVendors } from "@/lib/vendors/service";
import { getTemplates as getQuestionnaireTemplates } from "@/lib/questionnaire-templates/service";
import { getTemplates as getInventoryTemplates } from "@/lib/event-inventory/service";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Setup Profiles — Settings" };

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SetupProfilesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialCreateEventType = firstParam(params.eventType);
  const initialProfileId = firstParam(params.profileId);
  const initialCreate = firstParam(params.create) === "1";
  const venue = await getCurrentVenue();
  const role = await getCurrentUserRole();
  const canEdit = role === "owner" || role === "manager";
  const listed = venue ? await listVenueSetupProfiles(venue.id) : { profiles: [], assignments: [] };
  const [playbooks, timelines, floorPlans, vendors, questionnaires, inventoryTemplates, eventOrderTemplates] = venue
    ? await Promise.all([
      getPlaybookTemplates(),
      getTimelineTemplates(),
      getFloorPlanTemplates(),
      getVendors(),
      getQuestionnaireTemplates(),
      getInventoryTemplates(),
      getEventOrderTemplates(),
    ])
    : [[], [], [], [], [], [], []];

  const steps = applicableSetupSteps(capabilitiesFromVenue(venue));
  const usedForOptions = buildSetupProfileUsedForOptions();

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <SetupHubReturnLink href="/setup-hub/make-htc-yours/event-experiences" label="Back to your event experiences" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Setup Profiles"
          description="This is where you tell Hello to Cheers how this venue normally operates."
        />
      </div>
      <SettingsTabs />
      {venue ? (
        <SetupProfilesSection
          canEdit={canEdit}
          steps={steps}
          profiles={listed.profiles}
          assignments={listed.assignments}
          usedForOptions={usedForOptions}
          initialCreate={initialCreate}
          initialCreateEventType={initialCreateEventType}
          initialProfileId={initialProfileId}
          playbooks={playbooks.filter((template) => template.kind === "client" && !template.isArchived).map((template) => ({
            id: template.id,
            name: template.name,
          }))}
          venuePlaybooks={playbooks.filter((template) => template.kind === "venue" && !template.isArchived).map((template) => ({
            id: template.id,
            name: template.name,
          }))}
          timelines={timelines.filter((template) => !template.isArchived).map((template) => ({
            id: template.id,
            name: template.name,
          }))}
          floorPlans={floorPlans.filter((template) => !template.isArchived).map((template) => ({
            id: template.id,
            name: template.name,
          }))}
          vendors={vendors.map((vendor) => ({
            id: vendor.id,
            name: vendor.businessName,
          }))}
          questionnaires={questionnaires.filter((template) => !template.isArchived).map((template) => ({
            id: template.id,
            name: template.name,
          }))}
          inventoryTemplates={inventoryTemplates.filter((template) => !template.isArchived).map((template) => ({
            id: template.id,
            name: template.name,
          }))}
          eventOrderTemplates={eventOrderTemplates.filter((template) => !template.isArchived).map((template) => ({
            id: template.id,
            name: template.name,
          }))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No venue found.</p>
      )}
    </div>
  );
}

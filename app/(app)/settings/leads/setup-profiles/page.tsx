import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { SetupProfilesSection } from "@/components/settings/setup-profiles-section";
import { applicableSetupSteps } from "@/lib/event-setup/state";
import { listVenueSetupProfiles } from "@/lib/event-setup/profiles";
import { buildSetupProfileUsedForOptions } from "@/lib/event-setup/setup-profile-event-types";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";
import { getTemplates as getPlaybookTemplates } from "@/lib/playbooks/service";
import { getTemplates as getTimelineTemplates } from "@/lib/timeline-templates/service";
import { getTemplates as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getVendors } from "@/lib/vendors/service";
import { getTemplates as getQuestionnaireTemplates } from "@/lib/questionnaire-templates/service";
import { getTemplates as getInventoryTemplates } from "@/lib/event-inventory/service";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Setup Profiles — Settings" };

export default async function SetupProfilesPage() {
  const venue = await getCurrentVenue();
  const role = await getCurrentUserRole();
  const canEdit = role === "owner" || role === "manager";
  const listed = venue ? await listVenueSetupProfiles(venue.id) : { profiles: [], assignments: [] };
  const [playbooks, timelines, floorPlans, vendors, questionnaires, inventoryTemplates, eventOrderTemplates, inquirySettings] = venue
    ? await Promise.all([
      getPlaybookTemplates(),
      getTimelineTemplates(),
      getFloorPlanTemplates(),
      getVendors(),
      getQuestionnaireTemplates(),
      getInventoryTemplates(),
      getEventOrderTemplates(),
      getInquiryFormSettings(),
    ])
    : [[], [], [], [], [], [], [], null];

  const steps = applicableSetupSteps({
    timeline: venue?.planningTimelineEnabled ?? true,
    floorPlan: venue?.planningFloorPlanEnabled ?? true,
    seating: venue?.planningSeatingEnabled ?? true,
    vendors: venue?.planningVendorsEnabled ?? true,
  });
  const usedForOptions = buildSetupProfileUsedForOptions(
    inquirySettings?.acceptedEventTypes ?? null,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setup Profiles"
        description="This is where you tell Hello to Cheers how this venue normally operates."
      />
      <SettingsTabs />
      {venue ? (
        <SetupProfilesSection
          canEdit={canEdit}
          steps={steps}
          profiles={listed.profiles}
          assignments={listed.assignments}
          usedForOptions={usedForOptions}
          playbooks={playbooks.filter((template) => template.kind === "client" && !template.isArchived).map((template) => ({
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

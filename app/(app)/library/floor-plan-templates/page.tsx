import type { Metadata } from "next";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { FloorPlanTemplateStarterPicker } from "@/components/floor-plan-templates/floor-plan-template-starter-picker";
import { FloorPlanTemplatesSection } from "@/components/floor-plan-templates/floor-plan-templates-section";
import { getSpaces } from "@/lib/availability/service";
import { getEvents } from "@/lib/events/service";
import {
  canDeleteFloorPlanRows,
  canEditFloorPlans,
} from "@/lib/floor-plans/authorize";
import { ensureFloorPlanStartersForCurrentVenue } from "@/lib/floor-plan-templates/provision";
import { getTemplatesForLibrary } from "@/lib/floor-plan-templates/service";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Floor Plan Templates" };

export default async function FloorPlanTemplatesPage() {
  await ensureFloorPlanStartersForCurrentVenue();
  const [templates, spaces, venue, events, role, inquirySettings] = await Promise.all([
    getTemplatesForLibrary(),
    getSpaces(),
    getCurrentVenue(),
    getEvents(),
    getCurrentUserRole(),
    getInquiryFormSettings(),
  ]);
  const acceptedEventTypes = inquirySettings?.acceptedEventTypes ?? [];
  const canEdit = canEditFloorPlans(role);
  const activeTemplates = templates.filter((t) => !t.isArchived);

  return (
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Floor Plan Templates"
        description="Reusable room layouts a venue builds once and applies to any booking."
        actions={
          canEdit ? (
            <FloorPlanTemplateStarterPicker
              existingTemplates={activeTemplates}
              spaces={spaces}
              venueId={venue?.id ?? ""}
              acceptedEventTypes={acceptedEventTypes}
            />
          ) : undefined
        }
      />
      <LibraryHowItWorks>
        Layout, background image, and placed objects are edited in the floor plan editor. Assign a space and place inventory items marked for floor plans.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Need to add tables, chairs, or other placeable items? Create them in Available Inventory and mark them for floor plans. Spaces are managed under Availability."
        action={{ href: "/library/inventory", label: "Manage Available Inventory" }}
        secondaryActions={[
          { href: "/settings/availability", label: "Manage Spaces (Availability)" },
        ]}
      >
        Uses spaces from Availability and inventory items marked for floor plans.
      </LibraryDependencyNote>
      <FloorPlanTemplatesSection
        initialTemplates={templates}
        spaces={spaces}
        venueId={venue?.id ?? ""}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate }))}
        acceptedEventTypes={acceptedEventTypes}
        canEdit={canEdit}
        canDelete={canDeleteFloorPlanRows(role)}
        headerCreate={false}
      />
    </div>
  );
}

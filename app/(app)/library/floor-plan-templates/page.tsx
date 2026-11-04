import type { Metadata } from "next";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote } from "@/components/library/library-guidance";
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
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Floor Plan Templates"
          description="Reusable room layouts you build once and apply to any booking."
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
      </div>
      <LibraryDependencyNote
        tone="calm"
        detail={
          <>
            Layout, background image, and placed objects are edited in the floor plan editor. Assign a
            space and place inventory items marked for floor plans. Event type is the booking kind
            (Wedding, Reception Only, and so on); layout purpose is the room arrangement (Ceremony,
            Cocktail Hour, Reception Only layout, and so on). Applying a floor plan happens on the
            event — not as a client send from the Library.
          </>
        }
        action={{ href: "/library/inventory", label: "Manage Available Inventory" }}
        secondaryActions={[
          { href: "/settings/availability", label: "Manage Spaces (Availability)" },
        ]}
      >
        How Floor Plan Templates work
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

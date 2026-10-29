import type { Metadata } from "next";

import { CapacityRulesSection } from "@/components/availability/capacity-rules-section";
import { VenueSpacesSection } from "@/components/availability/venue-spaces-section";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { AppointmentsOfferedControl } from "@/components/settings/appointments-offered-control";
import { ScheduledAppointmentTypesSection } from "@/components/settings/scheduled-appointment-types-section";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { TourAvailabilityEditor } from "@/components/settings/tour-availability-editor";
import { ToursOfferedControl } from "@/components/settings/tours-offered-control";
import { HoldAvailabilityControl } from "@/components/settings/hold-availability-control";
import { SimultaneousPublicAvailabilityControl } from "@/components/settings/simultaneous-public-availability-control";
import { TourEventOverlapControl } from "@/components/settings/tour-event-overlap-control";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getScheduleItemTypesForSettings } from "@/lib/calendar/schedule-item-catalog-service";
import { getCapacityRules, getSpaces } from "@/lib/availability/service";
import { getIntakeForVenue } from "@/lib/onboarding/intake-service";
import { editorHydrationFromAvailability } from "@/lib/tours/availability-read";
import { getTourAvailability, getTourSettings } from "@/lib/tours/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Availability & Capacity — Settings" };

export default async function AvailabilityCapacitySettingsPage() {
  const [spaces, capacityRules, tourAvailability, catalogTypes, role, tourSettings, venue] = await Promise.all([
    getSpaces(),
    getCapacityRules(),
    getTourAvailability(),
    getScheduleItemTypesForSettings(),
    getCurrentUserRole(),
    getTourSettings(),
    getCurrentVenue(),
  ]);
  const intake = venue?.id ? await getIntakeForVenue(venue.id) : null;
  const { windows, exceptions, loadError } = editorHydrationFromAvailability(tourAvailability);
  const canEditCatalog = role === "owner" || role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability & Capacity"
        description="Tour hours, blocked dates, spaces, and operating limits."
      />
      <SettingsTabs />

      <section className="rounded-lg border border-border bg-card px-4 py-4 sm:px-5" data-testid="availability-settings-guidance">
        <h2 className="text-base font-semibold text-heading">How date availability works</h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            You control when a date is protected.
          </p>
          <p>
            A preferred date from an inquiry does not reserve the date. A date is protected only when you place a Hold or move a relationship to Booked. HTC does not decide that a contract, payment, or other milestone means a booking — your venue&apos;s workflow determines when a relationship is Booked.
          </p>
          <p>
            <span className="font-medium text-heading">Public Available / Not available. </span>
            Available means a prospect may submit an inquiry for that date — it is not a reservation or a guarantee. At a multi-space venue, a date may stay open for inquiries when one event is booked and another suitable space may still be available, depending on your settings and capacity. An open date does not mean every space, time, or event configuration is available. Not available means your venue&apos;s current availability rules prevent another event from being accepted for that date — including holds, blocked dates, capacity, and booked occupancy. Prospects often read Available as a real chance to hold their event, and may be disappointed if you later explain that you cannot accommodate them.
          </p>
          <p>
            <span className="font-medium text-heading">When to block an entire day. </span>
            Block an entire date when you do not want additional event inquiries that day — for example a private buyout, a venue closure, or a day you do not want to accommodate another event. Use Blocked Dates, a full-day calendar block, or a whole-venue hold. Having one event booked is different: you do not need to block the whole date merely because one space is occupied, if your venue can host another event in a different space and you allow public inquiries for that situation below.
          </p>
          <p>
            <span className="font-medium text-heading">Booked events and public availability. </span>
            By default, a booked event closes that date for prospective clients — even when another Event Space may be free. Venues that intentionally book multiple events on the same day can enable the preference below to allow inquiries when capacity and availability rules permit. That setting allows further inquiries; it does not promise a suitable space or guarantee a booking. Your simultaneous-event capacity remains a separate limit on what staff can book internally.
          </p>
          <p>
            <span className="font-medium text-heading">Your responsibility. </span>
            Choose holds, blocked dates, capacity, spaces, and the public-inquiry preference so the public calendar matches how you actually book.
          </p>
          <p>
            <span className="font-medium text-heading">Holds. </span>
            Choose whether venue-created Holds prevent other bookings. This setting applies wherever HTC checks availability.
          </p>
          <p>
            <span className="font-medium text-heading">Tours. </span>
            Choose whether tours can be scheduled when an event is occupying the date. This setting applies wherever HTC checks availability.
          </p>
        </div>
      </section>

      <Card id="tour-availability" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Weekly Availability &amp; Blocked Dates</CardTitle>
          <CardDescription>
            When tours can be booked, and any dates you need to block off. This is Tour Availability —
            separate from your general Business Hours in Settings → Business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToursOfferedControl initialEnabled={tourSettings?.tourSchedulingEnabled ?? false} />
          <TourAvailabilityEditor
            initialWindows={windows}
            initialExceptions={exceptions}
            loadError={loadError}
          />
          <SetupGuideLink href="/help/how-do-i-set-my-tour-availability" label="How Do I Set My Tour Availability?" />
        </CardContent>
      </Card>

      <Card id="appointments-offered" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Appointments other than tours</CardTitle>
          <CardDescription>
            Same preferences collected during setup. This is how your venue works — it does not
            by itself enable online booking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppointmentsOfferedControl
            initialOffers={intake?.offersTastingsOrAppointments ?? null}
            initialTypeKeys={intake?.appointmentTypeKeys ?? []}
            initialOther={intake?.appointmentTypesOther ?? ""}
            canEdit={canEditCatalog}
          />
        </CardContent>
      </Card>

      <Card id="scheduled-appointment-types" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Scheduled appointment types</CardTitle>
          <CardDescription>
            Choose the kinds of appointments and reserved time your team can add on the Calendar. You can turn types on or off and add your own.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduledAppointmentTypesSection
            initialTypes={catalogTypes}
            canEdit={canEditCatalog}
          />
        </CardContent>
      </Card>

      <Card id="date-holds" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Date holds and availability</CardTitle>
          <CardDescription>
            A hold temporarily protects a date. It is not a booking, and it is separate from tours and appointments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <HoldAvailabilityControl initialBlocks={venue?.holdBlocksAvailability !== false} />
          <SimultaneousPublicAvailabilityControl
            initialAllows={venue?.allowSimultaneousPublicAvailability === true}
          />
          <TourEventOverlapControl initialAllows={venue?.allowToursDuringBookedEvents === true} />
        </CardContent>
      </Card>

      <Card id="capacity" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Scheduling Capacity</CardTitle>
          <CardDescription>
            Event and tour simultaneous limits and event turnaround are enforced when booking. A missing simultaneous setting is treated as 1 — never unlimited. Turnaround of 0 means events may be back-to-back. These limits guide staff scheduling and do not override the separate preference under Date holds and availability for whether public inquiries can stay open when another event is booked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CapacityRulesSection initialRules={capacityRules} />
          <SetupGuideLink href="/help/how-do-i-set-my-tour-availability" label="How Do I Set My Tour Availability?" />
        </CardContent>
      </Card>

      <Card id="spaces" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Event Spaces</CardTitle>
          <CardDescription>
            Define the named physical spaces within your venue (Ballroom, Garden, Barn…).
            Each space can have its own capacity and permitted uses (Ceremony, Reception, and others).
            Uses are what happens there — they are not separate spaces. If you have more than one
            space, add them here before bringing over dated events in Bring Your Business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <VenueSpacesSection
            initialSpaces={spaces}
            spaceOperatingMode={venue?.spaceOperatingMode ?? "single"}
          />
          <SetupGuideLink href="/help/what-should-i-set-up-before-i-start" label="What Should I Set Up Before I Start?" />
        </CardContent>
      </Card>
    </div>
  );
}

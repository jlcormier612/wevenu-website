import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, MapPin } from "lucide-react";

import { PageHeader } from "@/components/shell/module-placeholder";
import { TourArchivedSection, TourList, TourSectionEmpty } from "@/components/tours/tour-list";
import { Button } from "@/components/ui/button";
import { markVenueToursSeen } from "@/lib/navigation/attention-service";
import { partitionTourAppointmentsForVenueList } from "@/lib/tours/list-order";
import { getArchivedTourAppointments, getTourAppointments, getTourSettings } from "@/lib/tours/service";
import { listUnresolvedProtectionRequests } from "@/lib/tours/protection";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { PaidUnbookedProtectionList } from "@/components/tours/paid-unbooked-protection-list";
import { canRefundTourFee } from "@/lib/tours/protection-rules";

export const metadata: Metadata = { title: "Tours" };

export default async function ToursPage() {
  const [appointments, archivedAppointments, tourSettings, unresolvedProtection, role, venue] = await Promise.all([
    getTourAppointments(),
    getArchivedTourAppointments(),
    getTourSettings(),
    listUnresolvedProtectionRequests(),
    getCurrentUserRole(),
    getCurrentVenue(),
  ]);

  // Staff opened Tours — clear unseen tour appointment attention (protection
  // follow-ups remain until resolved).
  void markVenueToursSeen();

  const { upcoming, past, cancelled } = partitionTourAppointmentsForVenueList(appointments);
  const hasWorking = upcoming.length > 0 || past.length > 0 || cancelled.length > 0;
  const hasAny = hasWorking || archivedAppointments.length > 0;
  const tz = venue?.timezone ?? null;

  return (
    <div className="htc-hospitality-page htc-tours-workspace space-y-5 sm:space-y-6">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Tours"
          description="Upcoming, past, and cancelled venue tour appointments."
          actions={
            tourSettings?.tourSchedulingEnabled ? (
              <Button size="sm" variant="outline" render={<Link href="/settings/leads#tours" />}>
                <MapPin className="mr-1.5 h-3.5 w-3.5" /> Booking Settings
              </Button>
            ) : undefined
          }
        />
      </div>

      {unresolvedProtection.length > 0 && (
        <section className="htc-tours-followup" data-tours-followup="">
          <header data-tours-section-header="">
            <h2 data-tours-section-title="">Needs follow-up ({unresolvedProtection.length})</h2>
            <p data-tours-section-desc="">
              Payment or card-on-file succeeded, but the requested time was no longer available. No tour was booked.
            </p>
          </header>
          <div data-tours-section-body="">
            <PaidUnbookedProtectionList requests={unresolvedProtection} canRefund={canRefundTourFee(role)} />
          </div>
        </section>
      )}

      {!hasAny ? (
        <section className="htc-tours-empty-page" data-tours-empty="workspace">
          <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          <p data-tours-empty-title="">No tours yet</p>
          <p data-tours-empty-copy="">
            Once tour scheduling is enabled and couples book a visit, their appointments will appear here.
          </p>
          {!tourSettings?.tourSchedulingEnabled && (
            <Button size="sm" variant="outline" render={<Link href="/settings/leads" />}>
              Enable Tour Scheduling →
            </Button>
          )}
        </section>
      ) : (
        <div className="space-y-5">
          <section className="htc-tours-section" data-tours-section="upcoming">
            <header data-tours-section-header="">
              <h2 data-tours-section-title="">Upcoming ({upcoming.length})</h2>
              <p data-tours-section-desc="">Tours still ahead — scheduled or confirmed.</p>
            </header>
            <div data-tours-section-body="">
              {upcoming.length > 0 ? (
                <TourList appointments={upcoming} venueTimezone={tz} />
              ) : (
                <TourSectionEmpty
                  title="Nothing upcoming"
                  copy="When a couple books a tour or you schedule one from a lead, it will show here."
                />
              )}
            </div>
          </section>

          <section className="htc-tours-section" data-tours-section="past">
            <header data-tours-section-header="">
              <h2 data-tours-section-title="">Past ({past.length})</h2>
              <p data-tours-section-desc="">Completed and no-show tours, plus any overdue appointments still open.</p>
            </header>
            <div data-tours-section-body="">
              {past.length > 0 ? (
                <TourList appointments={past} venueTimezone={tz} />
              ) : (
                <TourSectionEmpty
                  title="No past tours yet"
                  copy="Completed and no-show appointments will collect here after the visit."
                />
              )}
            </div>
          </section>

          <section className="htc-tours-section" data-tours-section="cancelled">
            <header data-tours-section-header="">
              <h2 data-tours-section-title="">Cancelled ({cancelled.length})</h2>
              <p data-tours-section-desc="">
                Cancelled appointments stay visible here until you archive them. Cancelled is not the same as Archived.
              </p>
            </header>
            <div data-tours-section-body="">
              {cancelled.length > 0 ? (
                <TourList appointments={cancelled} venueTimezone={tz} />
              ) : (
                <TourSectionEmpty
                  title="No cancelled tours"
                  copy="If a tour is cancelled, it remains discoverable in this section until archived."
                />
              )}
            </div>
          </section>

          {!hasWorking && archivedAppointments.length > 0 && (
            <p className="text-sm text-muted-foreground">
              No active tours in Upcoming, Past, or Cancelled. Open Archived below to restore one.
            </p>
          )}

          {archivedAppointments.length > 0 ? (
            <TourArchivedSection
              appointments={archivedAppointments}
              venueTimezone={tz}
            />
          ) : (
            <section className="htc-tours-section" data-tours-section="archived-empty">
              <header data-tours-section-header="">
                <h2 data-tours-section-title="">Archived (0)</h2>
                <p data-tours-section-desc="">
                  Archived is staff housekeeping — separate from Cancelled status.
                </p>
              </header>
              <div data-tours-section-body="">
                <TourSectionEmpty
                  title="Nothing archived"
                  copy="Archive a tour from the row menu when you no longer need it in Upcoming, Past, or Cancelled. You can restore it later."
                />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

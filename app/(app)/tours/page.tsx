import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, MapPin } from "lucide-react";

import { PageHeader } from "@/components/shell/module-placeholder";
import { TourList } from "@/components/tours/tour-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { markVenueToursSeen } from "@/lib/navigation/attention-service";
import { partitionTourAppointmentsForVenueList } from "@/lib/tours/list-order";
import { getTourAppointments, getTourSettings } from "@/lib/tours/service";
import { listUnresolvedProtectionRequests } from "@/lib/tours/protection";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { PaidUnbookedProtectionList } from "@/components/tours/paid-unbooked-protection-list";
import { canRefundTourFee } from "@/lib/tours/protection-rules";

export const metadata: Metadata = { title: "Tours" };

export default async function ToursPage() {
  const [appointments, tourSettings, unresolvedProtection, role, venue] = await Promise.all([
    getTourAppointments(),
    getTourSettings(),
    listUnresolvedProtectionRequests(),
    getCurrentUserRole(),
    getCurrentVenue(),
  ]);

  // Staff opened Tours — clear unseen tour appointment attention (protection
  // follow-ups remain until resolved).
  void markVenueToursSeen();

  const { upcoming, past } = partitionTourAppointmentsForVenueList(appointments);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title="Tours" description="Upcoming and past venue tour appointments." />
        {tourSettings?.tourSchedulingEnabled && (
          <Button size="sm" variant="outline" render={<Link href="/settings/leads#tours" />}>
            <MapPin className="mr-1.5 h-3.5 w-3.5" /> Booking Settings
          </Button>
        )}
      </div>

      {unresolvedProtection.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs follow-up ({unresolvedProtection.length})</CardTitle>
            <CardDescription>
              Payment or card-on-file succeeded, but the requested time was no longer available. No tour was booked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaidUnbookedProtectionList requests={unresolvedProtection} canRefund={canRefundTourFee(role)} />
          </CardContent>
        </Card>
      )}

      {appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CalendarCheck className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-heading">No tours yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Once tour scheduling is enabled and clients book a visit, their appointments will appear here.
            </p>
            {!tourSettings?.tourSchedulingEnabled && (
              <Button size="sm" variant="outline" render={<Link href="/settings/leads" />}>
                Enable Tour Scheduling →
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming ({upcoming.length})</CardTitle>
                <CardDescription>Scheduled tours awaiting confirmation or completion.</CardDescription>
              </CardHeader>
              <CardContent>
                <TourList appointments={upcoming} venueTimezone={venue?.timezone ?? null} />
              </CardContent>
            </Card>
          )}
          {past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Past</CardTitle>
              </CardHeader>
              <CardContent>
                <TourList appointments={past} venueTimezone={venue?.timezone ?? null} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

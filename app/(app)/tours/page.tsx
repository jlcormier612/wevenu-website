import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, MapPin } from "lucide-react";

import { PageHeader } from "@/components/shell/module-placeholder";
import { TourList } from "@/components/tours/tour-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTourAppointments, getTourSettings } from "@/lib/tours/service";

export const metadata: Metadata = { title: "Tours" };

export default async function ToursPage() {
  const [appointments, tourSettings] = await Promise.all([
    getTourAppointments(),
    getTourSettings(),
  ]);

  const upcoming = appointments.filter((a) => a.status !== "cancelled" && a.status !== "completed" && a.status !== "no_show" && new Date(a.scheduledAt) >= new Date());
  const past     = appointments.filter((a) => a.status === "completed" || a.status === "no_show" || (a.status !== "cancelled" && new Date(a.scheduledAt) < new Date()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title="Tours" description="Upcoming and past venue tour appointments." />
        {tourSettings?.tourSchedulingEnabled && (
          <Button size="sm" variant="outline" render={<Link href="/settings#tours" />}>
            <MapPin className="mr-1.5 h-3.5 w-3.5" /> Booking Settings
          </Button>
        )}
      </div>

      {appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CalendarCheck className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-heading">No tours yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Once tour scheduling is enabled and clients book a visit, their appointments will appear here.
            </p>
            {!tourSettings?.tourSchedulingEnabled && (
              <Button size="sm" variant="outline" render={<Link href="/settings" />}>
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
                <TourList appointments={upcoming} />
              </CardContent>
            </Card>
          )}
          {past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Past</CardTitle>
              </CardHeader>
              <CardContent>
                <TourList appointments={past} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

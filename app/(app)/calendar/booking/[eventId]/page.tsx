import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { BookingScheduleView } from "@/components/calendar/booking-schedule-view";
import { getBookingScheduleData } from "@/lib/calendar/booking-schedule";

export const metadata: Metadata = { title: "Booking Schedule" };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Booking Schedule — Calendar Integration Phase 3. Calendar's own
 * booking-specific lens, not the Booking Workspace itself: reachable from
 * Calendar, always links back out to each item's true owning workspace.
 */
export default async function BookingSchedulePage({ params }: Props) {
  const { eventId } = await params;
  const data = await getBookingScheduleData(eventId);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <Link href="/calendar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to Calendar
      </Link>
      <BookingScheduleView data={data} />
    </div>
  );
}

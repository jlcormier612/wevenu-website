"use client";

import * as React from "react";

import { bookingWorkspacePathFromEvent } from "@/lib/events/event-booking-redirect";

/**
 * Client-side replace so #hash from /events/{id}#… survives the move to the
 * Booking workspace. Next.js server redirect() cannot forward fragments.
 */
export function EventToBookingRedirect({
  clientId,
  search = "",
}: {
  clientId: string;
  search?: string;
}) {
  React.useEffect(() => {
    const target = bookingWorkspacePathFromEvent({
      clientId,
      search,
      hash: window.location.hash,
    });
    window.location.replace(target);
  }, [clientId, search]);

  return (
    <p className="p-6 text-sm text-muted-foreground" role="status">
      Opening booking…
    </p>
  );
}

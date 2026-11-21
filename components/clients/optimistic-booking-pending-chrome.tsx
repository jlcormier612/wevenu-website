/**
 * Client-only pending chrome while booking RSC streams.
 * Name + Back affordance only — no Cancel/Return/status (server owns those).
 */
export function OptimisticBookingPendingChrome({ title }: { title: string }) {
  return (
    <div
      className="space-y-5 px-3 py-4 sm:px-4 lg:px-6"
      data-testid="optimistic-booking-pending"
      data-booking-identity="optimistic"
    >
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">Bookings</p>
        <h1 className="htc-hospitality-heading font-heading text-2xl font-medium text-heading">
          {title}
        </h1>
      </div>
      <div className="htc-surface-working px-3 py-3 text-sm text-muted-foreground">
        <p>Opening booking…</p>
      </div>
    </div>
  );
}

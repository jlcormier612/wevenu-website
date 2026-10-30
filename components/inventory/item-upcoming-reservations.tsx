import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { formatStockDate, upcomingRowSentence, type ItemDateRow } from "@/lib/inventory/reservations";

/** Upcoming events using this item: reserved (couple approved) or waiting on approval. */
export function ItemUpcomingReservations({ owned, rows }: { owned: number; rows: ItemDateRow[] }) {
  return (
    <Card data-testid="inventory-upcoming-reservations">
      <CardContent className="space-y-2 pt-6">
        <p className="text-sm font-semibold text-heading">Upcoming events using this item</p>
        {owned <= 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="inventory-upcoming-untracked">
            Quantity is 0, so this item isn&apos;t tracked. Set how many you own to see shortages.
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="inventory-upcoming-empty">
            No upcoming Event Orders use this item.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.eventId}
                className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5 text-sm"
                data-testid="inventory-upcoming-row"
                data-short={r.short > 0 ? "true" : "false"}
                data-state={r.state}
              >
                <span>
                  <span className="text-muted-foreground">{formatStockDate(r.date)}</span>{" "}
                  <Link href={`/events/${r.eventId}#event-order-order`} className="text-foreground hover:underline">{r.name}</Link>
                  {" · "}
                  {r.quantity} {r.state === "reserved" ? "reserved" : "waiting on couple approval"}
                </span>
                {owned > 0 ? (
                  <span className={r.short > 0 ? "text-amber-800" : "text-muted-foreground"}>
                    {upcomingRowSentence(r, owned)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

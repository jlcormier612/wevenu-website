import Link from "next/link";

import { clientWorkspaceHref } from "@/lib/events/workspace-event";

type ClientEventOption = {
  id: string;
  eventDate: string | null;
  status: string;
  name: string;
};

function eventLabel(event: ClientEventOption): string {
  const date = event.eventDate?.slice(0, 10) || "Date to confirm";
  const name = event.name?.trim();
  return name ? `${name} · ${date}` : date;
}

export function ClientEventSwitcher({
  clientId,
  events,
  currentEventId,
}: {
  clientId: string;
  events: ClientEventOption[];
  currentEventId: string;
}) {
  if (events.length <= 1) return null;
  const current = events.find((event) => event.id === currentEventId) ?? events[0];
  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-2"
      data-testid="client-event-switcher"
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Viewing event</p>
        <p className="text-sm font-medium text-heading" data-testid="client-event-current">
          {current ? eventLabel(current) : "Event"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {events.map((event) => {
          const active = event.id === currentEventId;
          return (
            <Link
              key={event.id}
              href={clientWorkspaceHref(clientId, event.id)}
              data-testid={`client-event-link-${event.id}`}
              className={`rounded-md border px-2 py-1 text-xs ${
                active
                  ? "border-primary bg-primary/10 font-medium text-heading"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {eventLabel(event)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

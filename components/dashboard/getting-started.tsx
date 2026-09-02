import Link from "next/link";

import { ListChecks } from "lucide-react";

import { DashboardCardShell } from "@/components/dashboard-system/dashboard-card-shell";
import {
  groupVenueNextSteps,
  venueNextStepDueLabel,
  type VenueNextStep,
} from "@/lib/dashboard/venue-next-steps";

/**
 * Venue Home — Your Next Steps. State-driven queue of things that need
 * attention next. Not an onboarding carousel and not a discovery list.
 */
export function YourNextStepsCard({
  items,
  today,
}: {
  items: VenueNextStep[];
  today: string;
}) {
  if (items.length === 0) return null;
  const { venue, shared } = groupVenueNextSteps(items);

  return (
    <DashboardCardShell
      icon={<ListChecks className="h-4 w-4 text-primary" />}
      title="Your Next Steps"
      description="The things that need your attention next."
      isEmpty={false}
      emptyState={null}
    >
      <div className="space-y-4">
        {venue.length > 0 && (
          <NextStepsGroup heading="From your venue" items={venue} today={today} />
        )}
        {shared.length > 0 && (
          <NextStepsGroup heading="Shared planning" items={shared} today={today} />
        )}
      </div>
    </DashboardCardShell>
  );
}

function NextStepsGroup({
  heading,
  items,
  today,
}: {
  heading: string;
  items: VenueNextStep[];
  today: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{heading}</p>
      <div className="divide-y divide-border">
        {items.map((item) => {
          const due = venueNextStepDueLabel(item, today);
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-start justify-between gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                {item.context && (
                  <p className="text-xs text-muted-foreground truncate">{item.context}</p>
                )}
                <p className="text-xs text-muted-foreground">{item.description}</p>
                {due && (
                  <p className={`text-xs ${item.isOverdue ? "text-warning-foreground" : "text-muted-foreground"}`}>
                    {due}
                  </p>
                )}
              </div>
              <span className="shrink-0 pt-0.5 text-xs font-medium text-primary">
                {item.ctaLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

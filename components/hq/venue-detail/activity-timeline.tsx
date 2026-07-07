import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { HqTimelineEntry } from "@/lib/hq/venue-detail-types";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ActivityTimeline({ timeline }: { timeline: HqTimelineEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="font-heading text-sm font-semibold text-heading">Activity Timeline</h2>
        <p className="text-xs text-muted-foreground">Every meaningful event, timestamped and attributable.</p>
      </CardHeader>
      <CardContent className="pt-0">
        {timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 py-4 text-center">No activity recorded yet.</p>
        ) : (
          <ol className="space-y-2 max-h-96 overflow-y-auto">
            {timeline.map((entry, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className={entry.kind === "milestone" ? "mt-0.5 text-primary" : "mt-0.5 text-muted-foreground/50"} aria-hidden>
                  {entry.kind === "milestone" ? "★" : "•"}
                </span>
                <div className="flex-1 flex items-baseline justify-between gap-2">
                  <span className={entry.kind === "milestone" ? "font-medium text-heading" : "text-muted-foreground"}>{entry.label}</span>
                  <span className="shrink-0 text-muted-foreground/60">{fmt(entry.occurredAt)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

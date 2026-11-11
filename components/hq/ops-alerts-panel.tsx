import Link from "next/link";

import { acknowledgeOpsIncidentAction } from "@/app/admin/ops-alerts/actions";
import { Button } from "@/components/ui/button";
import type { OpsIncident, OpsIncidentEvent, OpsSeverity } from "@/lib/hq/ops-incidents";

const SEVERITY_STYLES: Record<OpsSeverity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-amber-500/15 text-amber-800 border-amber-500/30",
  warning: "bg-yellow-500/10 text-yellow-900 border-yellow-500/25",
  info: "bg-muted text-muted-foreground border-border",
};

function fmtWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function OpsSeverityBadge({ severity }: { severity: OpsSeverity }) {
  return (
    <span
      className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}

export function OpsAlertsBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div
      data-testid="ops-alerts-banner"
      className="rounded-sm border border-destructive/40 bg-destructive/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
    >
      <div>
        <p className="text-sm font-semibold text-heading">
          {count} active platform operations alert{count === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Persistent HQ alerts — email was also attempted for state transitions.
        </p>
      </div>
      <Link
        href="/admin/ops-alerts"
        className="inline-flex h-8 items-center rounded-sm border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
      >
        View ops alerts
      </Link>
    </div>
  );
}

export function OpsIncidentList({
  incidents,
  emptyLabel = "No matching incidents.",
}: {
  incidents: OpsIncident[];
  emptyLabel?: string;
}) {
  if (incidents.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3" data-testid="ops-incident-list">
      {incidents.map((inc) => (
        <li
          key={inc.id}
          className="rounded-sm border bg-card px-4 py-3 space-y-2"
          data-testid="ops-incident-row"
          data-severity={inc.severity}
          data-status={inc.status}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <OpsSeverityBadge severity={inc.severity} />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {inc.status}
                </span>
                <span className="text-[10px] text-muted-foreground">{inc.sourceService}</span>
              </div>
              <Link
                href={`/admin/ops-alerts/${inc.id}`}
                className="text-sm font-medium text-heading hover:underline underline-offset-2"
              >
                {inc.title}
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed">{inc.summary}</p>
            </div>
            {inc.status === "active" ? (
              <form action={acknowledgeOpsIncidentAction}>
                <input type="hidden" name="incidentId" value={inc.id} />
                <Button type="submit" size="sm" variant="outline" data-testid="ops-acknowledge">
                  Acknowledge
                </Button>
              </form>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>First: {fmtWhen(inc.firstDetectedAt)}</span>
            <span>Updated: {fmtWhen(inc.lastObservedAt)}</span>
            <span>Observations: {inc.observationCount}</span>
            {inc.lastEmailOutcome ? <span>Email: {inc.lastEmailOutcome}</span> : null}
          </div>
          {inc.recommendedAction ? (
            <p className="text-xs text-heading/90">
              <span className="font-medium">Next:</span> {inc.recommendedAction}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function OpsIncidentDetail({
  incident,
  events,
}: {
  incident: OpsIncident;
  events: OpsIncidentEvent[];
}) {
  return (
    <div className="space-y-6" data-testid="ops-incident-detail">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <OpsSeverityBadge severity={incident.severity} />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{incident.status}</span>
          <span className="text-xs text-muted-foreground">{incident.sourceService}</span>
        </div>
        <h1 className="text-xl font-heading font-semibold text-heading">{incident.title}</h1>
        <p className="text-sm text-muted-foreground">{incident.summary}</p>
        <p className="text-sm">
          <span className="font-medium">Recommended action:</span> {incident.recommendedAction}
        </p>
        {(incident.status === "active") && (
          <form action={acknowledgeOpsIncidentAction} className="pt-1">
            <input type="hidden" name="incidentId" value={incident.id} />
            <Button type="submit" size="sm" data-testid="ops-acknowledge">
              Acknowledge (does not resolve)
            </Button>
          </form>
        )}
      </div>

      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p>First detected: {fmtWhen(incident.firstDetectedAt)}</p>
        <p>Last observed: {fmtWhen(incident.lastObservedAt)}</p>
        <p>Acknowledged: {incident.acknowledgedAt ? fmtWhen(incident.acknowledgedAt) : "—"}</p>
        <p>Recovered: {incident.recoveredAt ? fmtWhen(incident.recoveredAt) : "—"}</p>
        <p>Source alarm: {incident.sourceAlarm ?? "—"}</p>
        <p>Email outcome: {incident.lastEmailOutcome ?? "—"}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-heading mb-2">Timeline</h2>
        <ol className="space-y-2 border-l border-border pl-4">
          {events.map((ev) => (
            <li key={ev.id} className="text-xs">
              <p className="font-medium text-heading">
                {ev.eventType}
                {ev.severity ? ` · ${ev.severity}` : ""}
              </p>
              <p className="text-muted-foreground">{ev.message || "—"}</p>
              <p className="text-muted-foreground/80">{fmtWhen(ev.createdAt)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

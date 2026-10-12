import type { Metadata } from "next";
import Link from "next/link";

import { OpsAlertsBanner, OpsIncidentList } from "@/components/hq/ops-alerts-panel";
import {
  countActiveOpsIncidents,
  listOpsIncidents,
  type OpsIncidentStatus,
  type OpsSeverity,
} from "@/lib/hq/ops-incidents";

export const metadata: Metadata = { title: "Ops Alerts — Hello to Cheers HQ" };

export default async function OpsAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; service?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status as OpsIncidentStatus | "unresolved" | "all" | undefined) ?? "unresolved";
  const severity = (sp.severity as OpsSeverity | "all" | undefined) ?? "all";
  const service = sp.service ?? "all";

  const [incidents, activeCount] = await Promise.all([
    listOpsIncidents({ status, severity, service }),
    countActiveOpsIncidents(),
  ]);

  const filterHref = (next: Record<string, string>) => {
    const params = new URLSearchParams({
      status,
      severity,
      service,
      ...next,
    });
    return `/admin/ops-alerts?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-heading">Ops Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Persistent platform operations incidents. Email notifies on state transitions;
          unresolved alerts stay here until recovery.
        </p>
      </div>

      <OpsAlertsBanner count={activeCount} />

      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            ["unresolved", "Unresolved"],
            ["active", "Active"],
            ["acknowledged", "Acknowledged"],
            ["recovered", "Recovered"],
            ["all", "All"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={filterHref({ status: value })}
            className={`rounded-sm border px-2 py-1 ${status === value ? "bg-muted font-semibold" : "hover:bg-muted/60"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            ["all", "All severities"],
            ["critical", "Critical"],
            ["high", "High"],
            ["warning", "Warning"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={filterHref({ severity: value })}
            className={`rounded-sm border px-2 py-1 ${severity === value ? "bg-muted font-semibold" : "hover:bg-muted/60"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            ["all", "All services"],
            ["supabase", "Supabase"],
            ["resend", "Resend"],
            ["infrastructure", "Infrastructure"],
            ["monitoring", "Monitoring"],
            ["auth", "Auth"],
            ["database", "Database"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={filterHref({ service: value })}
            className={`rounded-sm border px-2 py-1 ${service === value ? "bg-muted font-semibold" : "hover:bg-muted/60"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <OpsIncidentList incidents={incidents} emptyLabel="No incidents match these filters." />
    </div>
  );
}

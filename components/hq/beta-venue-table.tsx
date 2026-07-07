import Link from "next/link";

import { HealthBadge, TrendIndicator } from "@/components/hq/health-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BetaVenueSummary } from "@/lib/hq/beta-types";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BetaVenueTable({ venues }: { venues: BetaVenueSummary[] }) {
  if (venues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border py-16">
        <p className="text-3xl">📊</p>
        <p className="text-sm font-medium text-heading">No venues match this filter</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Venue</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Activation</TableHead>
            <TableHead>Trend</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Couple</TableHead>
            <TableHead>Risk Factors</TableHead>
            <TableHead>Last Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {venues.map((v) => (
            <TableRow key={v.venueId} className="cursor-pointer">
              <TableCell className="font-medium text-heading">
                <Link href={`/admin/venues/${v.venueId}`} className="hover:underline">
                  {v.venueName}
                </Link>
              </TableCell>
              <TableCell><HealthBadge status={v.healthStatus} /></TableCell>
              <TableCell className="font-semibold">{v.score}%</TableCell>
              <TableCell><TrendIndicator trend={v.trend} /></TableCell>
              <TableCell className="text-muted-foreground">{fmtDate(v.lastLoginAt)}</TableCell>
              <TableCell className="text-muted-foreground">{v.teamAdoptionPct}%</TableCell>
              <TableCell className="text-muted-foreground">{v.vendorAdoptionPct}%</TableCell>
              <TableCell className="text-muted-foreground">{v.coupleAdoptionPct}%</TableCell>
              <TableCell>
                {v.riskSignals.length === 0 ? (
                  <span className="text-xs text-muted-foreground/60">—</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning" title={v.riskSignals.map((s) => s.label).join("; ")}>
                    {v.riskSignals.length} signal{v.riskSignals.length === 1 ? "" : "s"}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{fmtDate(v.lastEngagementAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

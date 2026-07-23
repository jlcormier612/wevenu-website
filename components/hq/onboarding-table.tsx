import Link from "next/link";

import { OnboardingStatusBadge } from "@/components/hq/onboarding-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OnboardingEngagementSummary } from "@/lib/hq/onboarding-types";

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Cross-account White-Glove dashboard (§2.2a step 3) — one row per venue
 * with an onboarding engagement. Same "list view → row click → full detail
 * page" convention as BetaVenueTable, not a new interaction pattern. The
 * per-venue detail page it links to (`/admin/onboarding/[venueId]`) is
 * §2.2a step 4 — not built yet, so the row link is live but its
 * destination isn't.
 */
export function OnboardingTable({ engagements }: { engagements: OnboardingEngagementSummary[] }) {
  if (engagements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border py-16">
        <p className="text-3xl">🤝</p>
        <p className="text-sm font-medium text-heading">No onboarding engagements yet</p>
        <p className="text-xs text-muted-foreground">Starting one from a venue's detail page will show it here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Venue</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Specialist</TableHead>
            <TableHead>Current Focus</TableHead>
            <TableHead>Blockers</TableHead>
            <TableHead>Last Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {engagements.map((e) => (
            <TableRow key={e.id} className="cursor-pointer">
              <TableCell className="font-medium text-heading">
                <Link href={`/admin/onboarding/${e.venueId}`} className="hover:underline">
                  {e.venueName}
                </Link>
              </TableCell>
              <TableCell><OnboardingStatusBadge status={e.status} /></TableCell>
              <TableCell className="text-muted-foreground">{e.assignedName ?? "Unassigned"}</TableCell>
              <TableCell className="text-muted-foreground">{e.currentFocus ?? "—"}</TableCell>
              <TableCell>
                {e.openBlockerCount === 0 ? (
                  <span className="text-xs text-muted-foreground/60">—</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    {e.openBlockerCount} open
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{daysSince(e.updatedAt)}d ago</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

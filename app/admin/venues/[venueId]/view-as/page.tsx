import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";

import { ActivityTimeline } from "@/components/hq/venue-detail/activity-timeline";
import { EngagementSection } from "@/components/hq/venue-detail/engagement-section";
import { OverviewSection } from "@/components/hq/venue-detail/overview-section";
import { getVenueHqDetail } from "@/lib/hq/venue-detail-service";

export const metadata: Metadata = { title: "View As — Wevenu HQ" };

type Props = { params: Promise<{ venueId: string }> };

/**
 * Read-only View-As snapshot. Phase 1 scope: a clearly-labeled, read-only
 * render of this venue's own data — not a literal drop-in to their live app
 * session. True in-app impersonation (browsing /dashboard, /leads, etc. as
 * the venue, enforced via a custom session claim) is a deliberate Phase 2,
 * not built here. See docs/wevenu-hq-architecture.md §2.5.
 */
export default async function ViewAsPage({ params }: Props) {
  const { venueId } = await params;
  const detail = await getVenueHqDetail(venueId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <Eye className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <p className="flex-1 text-foreground">
          <span className="font-semibold">Viewing as {detail.venue.name}</span> — read-only snapshot.
        </p>
        <Link href={`/admin/venues/${venueId}`} className="text-xs font-medium text-primary underline underline-offset-2 shrink-0">
          Exit
        </Link>
      </div>

      <OverviewSection activation={detail.activation} />
      <ActivityTimeline timeline={detail.timeline} />
      <EngagementSection team={detail.team} vendors={detail.vendors} couples={detail.couples} />
    </div>
  );
}

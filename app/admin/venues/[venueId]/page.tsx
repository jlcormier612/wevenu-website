import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline } from "@/components/hq/venue-detail/activity-timeline";
import { EngagementSection } from "@/components/hq/venue-detail/engagement-section";
import { LuvInsights } from "@/components/hq/venue-detail/luv-insights";
import { OverviewSection } from "@/components/hq/venue-detail/overview-section";
import { SupportSection } from "@/components/hq/venue-detail/support-section";
import { ViewAsButton } from "@/components/hq/venue-detail/view-as-button";
import { getVenueHqDetail } from "@/lib/hq/venue-detail-service";

export const metadata: Metadata = { title: "Venue — Wevenu HQ" };

type Props = { params: Promise<{ venueId: string }> };

export default async function VenueHqDetailPage({ params }: Props) {
  const { venueId } = await params;
  const detail = await getVenueHqDetail(venueId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Beta Command Center</Link>
          <h1 className="text-2xl font-heading font-semibold text-heading mt-1">{detail.venue.name}</h1>
          <p className="text-xs text-muted-foreground">{detail.venue.email ?? "No email on file"} · venue since {new Date(detail.venue.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p>
        </div>
        <ViewAsButton venueId={venueId} />
      </div>

      <OverviewSection activation={detail.activation} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityTimeline timeline={detail.timeline} />
        <LuvInsights activation={detail.activation} />
      </div>

      <EngagementSection team={detail.team} vendors={detail.vendors} couples={detail.couples} />

      <SupportSection venueId={venueId} notes={detail.notes} tasks={detail.tasks} crmState={detail.crmState} />
    </div>
  );
}

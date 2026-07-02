import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { LeadFunnelCard } from "@/components/analytics/lead-funnel-card";
import { EventsCard } from "@/components/analytics/events-card";
import { PaymentsCard } from "@/components/analytics/payments-card";
import { CoupleEngagementCard } from "@/components/analytics/couple-engagement-card";
import { FeatureAdoptionCard } from "@/components/analytics/feature-adoption-card";
import { HealthScoresSection } from "@/components/analytics/health-scores-section";
import { LuvRollUpCard } from "@/components/luv/luv-roll-up-card";
import { getVenueAnalytics, getClientHealthScores } from "@/lib/analytics/service";

export const metadata: Metadata = { title: "Insights" };

export default async function AnalyticsPage() {
  const [analytics, health] = await Promise.all([
    getVenueAnalytics(),
    getClientHealthScores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Lead conversion, couple engagement, and venue performance."
      />

      {/* Luv Roll-Up — synthesized AI observations at the top */}
      <LuvRollUpCard />

      {/* Top grid — funnel + events */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeadFunnelCard data={analytics?.leadFunnel ?? null} />
        <EventsCard data={analytics?.events ?? null} />
      </div>

      {/* Middle grid — payments + engagement */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaymentsCard data={analytics?.payments ?? null} />
        <CoupleEngagementCard data={analytics?.coupleEngagement ?? null} />
      </div>

      {/* Feature Adoption — full width */}
      <FeatureAdoptionCard data={analytics?.featureAdoption ?? null} />

      {/* Client Health — full width */}
      <HealthScoresSection data={health} />
    </div>
  );
}

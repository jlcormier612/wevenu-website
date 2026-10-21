import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { MigrationCenter } from "@/components/settings/migration-center";
import { MigrationGuidancePanel } from "@/components/settings/migration-guidance-panel";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
import { getSourceProfilesAction } from "@/app/(app)/settings/migration-actions";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Migration Center — Settings" };

export default async function MigrationCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sourceParam = params.source;
  const initialSource = Array.isArray(sourceParam) ? sourceParam[0] ?? null : sourceParam ?? null;

  const [sourceProfiles, spaces, capacityRules, venue] = await Promise.all([
    getSourceProfilesAction(),
    getSpaces(),
    getCapacityRules(),
    getCurrentVenue(),
  ]);
  const cutover = evaluateCutoverPrerequisites({
    spacesCount: spaces.length,
    hasCapacityRules: capacityRules != null,
    maxSimultaneousEvents: capacityRules?.maxSimultaneousEvents ?? null,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Migration Center"
        description="Bring over events, tours, date holds, calendar blocks, packages, documents, and booked-event invoices, payment schedules, and signed agreements — with review before anything is created. For a small contact or template list (CSV, Excel, Word, or PDF), use Import Data."
      />
      <SetupGuideLink
        href="/help/what-should-i-set-up-before-i-start"
        label="How to bring your business over"
      />
      <MigrationGuidancePanel />
      <SettingsTabs />
      <MigrationCenter
        sourceProfiles={sourceProfiles}
        cutover={cutover}
        venueId={venue?.id ?? ""}
        initialSource={initialSource}
      />
    </div>
  );
}

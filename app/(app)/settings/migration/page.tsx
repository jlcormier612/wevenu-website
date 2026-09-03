import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { MigrationCenter } from "@/components/settings/migration-center";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
import { getSourceProfilesAction } from "@/app/(app)/settings/migration-actions";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";

export const metadata: Metadata = { title: "Migration Center — Settings" };

export default async function MigrationCenterPage() {
  const [sourceProfiles, spaces, capacityRules] = await Promise.all([
    getSourceProfilesAction(),
    getSpaces(),
    getCapacityRules(),
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
        description="Bring your business with you from wherever it lives today. If we don't list your system, you can still import a CSV or spreadsheet."
      />
      <SetupGuideLink href="/help/setup-bring-your-business" label="New to this? Walk through it step by step" />
      <SettingsTabs />
      <MigrationCenter sourceProfiles={sourceProfiles} cutover={cutover} />
    </div>
  );
}

import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { MigrationCenter } from "@/components/settings/migration-center";
import { getSourceProfilesAction } from "@/app/(app)/settings/migration-actions";

export const metadata: Metadata = { title: "Migration Center — Settings" };

export default async function MigrationCenterPage() {
  const sourceProfiles = await getSourceProfilesAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Migration Center"
        description="Bring your business over from another system — we'll help you recognize, check, and import it safely."
      />
      <SettingsTabs />
      <MigrationCenter sourceProfiles={sourceProfiles} />
    </div>
  );
}

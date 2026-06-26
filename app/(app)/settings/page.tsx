import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Settings"
      description="Venue configuration, white labeling and preferences."
    />
  );
}

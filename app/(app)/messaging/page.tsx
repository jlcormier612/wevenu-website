import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Messaging" };

export default function MessagingPage() {
  return (
    <ModulePlaceholder
      title="Messaging"
      description="One continuous conversation per lead and event."
    />
  );
}

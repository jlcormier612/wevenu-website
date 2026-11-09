import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/ui";
import { TierUpgradesConsole } from "@/components/tier-upgrades/tier-upgrades-console";
import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

export const metadata = { title: "Tier upgrades" };

export default async function TierUpgradesPage() {
  await ensureProgram4Data();
  if (!(await actorCan("manage_welcome_back"))) {
    redirect("/today");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Founder CRM"
        title="Tier upgrades"
        description="Visibility into volume-driven plan changes, notice and invoice audit evidence, and founder holds. Holds pause automatic upgrades without changing Stripe billing."
      />
      <TierUpgradesConsole />
    </div>
  );
}

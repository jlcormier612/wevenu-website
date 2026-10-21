import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ImportWizard } from "@/components/settings/import-wizard";
import { ImportHealthWidget } from "@/components/settings/import-health-widget";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
import type { EntityType } from "@/lib/import/types";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";

export const metadata: Metadata = { title: "Import Data — Settings" };

const VALID_TYPES = new Set<EntityType>(["couples", "leads", "vendors", "inventory", "packages"]);

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;

  const rawType = params.type as string | undefined;
  const initialEntity: EntityType | undefined =
    rawType && VALID_TYPES.has(rawType as EntityType) ? (rawType as EntityType) : undefined;

  const [spaces, capacityRules] = await Promise.all([getSpaces(), getCapacityRules()]);
  const cutover = evaluateCutoverPrerequisites({
    spacesCount: spaces.length,
    hasCapacityRules: capacityRules != null,
    maxSimultaneousEvents: capacityRules?.maxSimultaneousEvents ?? null,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold text-foreground">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bring a small, clean list of clients, leads, vendors, inventory templates, or package
          templates into Hello to Cheers. Import from CSV, Excel, Word, PDF, or a pasted list, then
          map your columns before anything is saved.
        </p>
        <SetupGuideLink href="/help/what-should-i-set-up-before-i-start" label="What Should I Set Up Before I Start?" />
      </div>
      <Suspense fallback={null}>
        <ImportHealthWidget />
      </Suspense>
      <div className="rounded-sm border border-border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          Bringing over existing bookings or financial records?
        </h2>
        <p className="text-xs text-muted-foreground">
          Use{" "}
          <Link href="/settings/migration" className="font-medium text-primary hover:underline">
            Migration Center
          </Link>{" "}
          to import events, tours, date holds, calendar blocks, invoices, payment schedules, and
          signed agreements.
        </p>
        <p className="text-xs text-muted-foreground">
          For dated events, set up{" "}
          <Link href="/settings/availability" className="font-medium text-primary hover:underline">
            Calendar &amp; Availability
          </Link>{" "}
          first. In Migration Center, use{" "}
          <Link href="/settings/migration" className="font-medium text-primary hover:underline">
            Active Commitment
          </Link>{" "}
          for invoices, payment schedules, and signed agreements.
        </p>
      </div>
      <ImportWizard initialEntity={initialEntity} cutover={cutover} />
    </div>
  );
}

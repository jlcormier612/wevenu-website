import type { Metadata } from "next";
import { Suspense } from "react";

import { ImportWizard } from "@/components/settings/import-wizard";
import { ImportHealthWidget } from "@/components/settings/import-health-widget";
import type { EntityType } from "@/lib/import/types";

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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bring your existing clients, leads, and vendors into Wevenu from any CSV export.
        </p>
      </div>
      <Suspense fallback={null}>
        <ImportHealthWidget />
      </Suspense>
      <ImportWizard initialEntity={initialEntity} />
    </div>
  );
}

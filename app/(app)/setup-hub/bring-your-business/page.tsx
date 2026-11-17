import type { Metadata } from "next";

import { ImportHealthWidget } from "@/components/settings/import-health-widget";
import { ImportWizard } from "@/components/settings/import-wizard";
import { MigrationCenter } from "@/components/settings/migration-center";
import { BringYourBusinessExperience } from "@/components/setup-hub/bring-your-business-experience";
import { getSourceProfilesAction } from "@/app/(app)/settings/migration-actions";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { getVenueDocuments } from "@/lib/documents/service";
import { hasDatedMigrationImport, hasSuccessfulImportActivity, importActivityTotals } from "@/lib/import/activity";
import { getImportBatches } from "@/lib/import/batches";
import type { EntityType } from "@/lib/import/types";
import type { MigrationEntityType } from "@/lib/migration/types";
import { evaluateCutoverPrerequisites, parseBringYourBusinessStage } from "@/lib/setup-hub/bring-your-business";
import { evaluateGuideProgress, spreadsheetImportedCount } from "@/lib/setup-hub/bring-your-business-guide";
import { hasBringYourBusinessWork } from "@/lib/setup-hub/bring-your-business-journey";
import { getSetupHubState } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Bring your business with you — Setup" };
export const dynamic = "force-dynamic";

const TEMPLATE_KINDS = new Set<EntityType>(["packages", "inventory"]);

function parseKind(raw: string | undefined): EntityType | undefined {
  if (!raw) return undefined;
  if (TEMPLATE_KINDS.has(raw as EntityType)) return raw as EntityType;
  if (raw === "leads" || raw === "vendors" || raw === "couples") return raw;
  if (raw === "clients") return "couples";
  return undefined;
}

function entityForStage(stage: string): MigrationEntityType {
  if (stage === "money") return "active_commitment";
  if (stage === "planning") return "document";
  return "event";
}

function relationshipEntity(stage: string): EntityType | null {
  if (stage === "leads") return "leads";
  if (stage === "vendors") return "vendors";
  if (stage === "clients") return "couples";
  return null;
}

export default async function BringYourBusinessGuidePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stageParam = Array.isArray(params.stage) ? params.stage[0] : params.stage;
  const entryParam = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const kindParam = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;
  const stage = parseBringYourBusinessStage(stageParam, kindParam ?? typeParam);
  const entryLane = entryParam === "files" ? "files" : entryParam === "import" ? "import" : null;
  const kind = parseKind(kindParam ?? typeParam);

  const venue = await getCurrentVenue();
  if (!venue) return null;

  const [hubState, spaces, capacityRules, importBatches, venueDocuments, sourceProfiles] = await Promise.all([
    getSetupHubState(),
    getSpaces(),
    getCapacityRules(),
    getImportBatches(),
    getVenueDocuments(),
    getSourceProfilesAction(),
  ]);

  const hasMigrationImport = hasDatedMigrationImport(importBatches);
  const hasImportedActivity = hasSuccessfulImportActivity(importBatches);
  const uploadedMaterialsCount = venueDocuments.filter((d) => d.tags.includes("setup_import")).length;
  const cutover = evaluateCutoverPrerequisites({
    spacesCount: spaces.length,
    hasCapacityRules: capacityRules != null,
    maxSimultaneousEvents: capacityRules?.maxSimultaneousEvents ?? null,
  });
  const progress = evaluateGuideProgress({
    batches: importBatches,
    hasMigrationImport,
    uploadedMaterialsCount,
    path: hubState?.bringYourBusinessPath ?? null,
  });
  const imported = spreadsheetImportedCount(importBatches);
  const totals = importActivityTotals(importBatches);
  const skipped = totals.skipped;
  const errors = totals.needsAttention;

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6 overflow-x-hidden">
      <BringYourBusinessExperience
        stage={stage}
        entryLane={entryLane}
        cutover={cutover}
        hasExistingWork={hasBringYourBusinessWork({
          spreadsheetImportedCount: imported,
          hasMigrationImport,
          hasImportedActivity,
        })}
        isWhiteGlove={hubState?.onboardingType === "white_glove"}
        readiness={{
          imported,
          skipped,
          errors,
          hasMigrationImport,
          leads: progress.leads,
          clients: progress.clients,
          vendors: progress.vendors,
          money: progress["packages-financials"],
          planning: progress.planning,
        }}
      >
        {relationshipEntity(stage) ? (
          <div className="space-y-4" data-testid={`byb-${stage}-tools`}>
            <ImportWizard
              initialEntity={relationshipEntity(stage)!}
              allowedEntities={[relationshipEntity(stage)!]}
              cutover={cutover}
            />
            <div data-testid="byb-import-secondary">
              <ImportHealthWidget />
            </div>
          </div>
        ) : null}
        {stage === "dates" || stage === "money" || stage === "planning" ? (
          <div data-testid={`byb-${stage}-tools`}>
            {stage === "planning" ? (
              <div className="mb-4">
                <ImportWizard
                  initialEntity={kind && TEMPLATE_KINDS.has(kind) ? kind : undefined}
                  allowedEntities={["packages", "inventory"]}
                  cutover={cutover}
                />
              </div>
            ) : null}
            <MigrationCenter
              sourceProfiles={sourceProfiles}
              cutover={cutover}
              venueId={venue.id}
              initialSource="another_system"
              hideSourcePicker
              embedded
              initialEntityType={entityForStage(stage)}
            />
          </div>
        ) : null}
      </BringYourBusinessExperience>
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import {
  addRowsToOwnSession,
  attachSourceFileToOwnSession,
  commitOwnSession,
  getOwnSessionResumeState,
  getOwnSessionSourceFiles,
  getOwnSessionSummary,
  listSessionsForCurrentVenue,
  reviewOwnRecord,
  runDedupeForOwnSession,
  startSelfServiceSession,
} from "@/lib/migration/service";
import * as repo from "@/lib/migration/repository";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { getSourceProfiles } from "@/lib/migration/source-profiles";
import type { MigrationEntityType, SourceKey, SourceRow } from "@/lib/migration/types";
import { proposeFieldMapping } from "@/lib/luv/import-assist";
import type { EntityType as LuvEntityType } from "@/lib/import/types";

export async function getSourceProfilesAction() {
  const supabase = await createClient();
  return getSourceProfiles(supabase);
}

// Migration Center's own entity vocabulary (client/lead/vendor) predates and
// is slightly narrower than lib/import/types.ts's EntityType (couples/leads/
// vendors/inventory/packages) — proposeFieldMapping already exists keyed to
// the latter, so this is a translation, not a new AI-mapping system. Field
// key vocabularies between the two are already near-identical (firstName/
// lastName/email/phone/...); any key Luv proposes that Migration Center's
// own mapping state doesn't recognize is simply dropped on merge, same as
// any other unmapped-field suggestion.
const LUV_ENTITY_BY_MIGRATION_ENTITY: Partial<Record<MigrationEntityType, LuvEntityType>> = {
  client: "couples",
  lead: "leads",
  vendor: "vendors",
};

export async function proposeMigrationFieldMappingAction(headers: string[], entityType: MigrationEntityType) {
  const luvEntity = LUV_ENTITY_BY_MIGRATION_ENTITY[entityType];
  if (!luvEntity) return { ok: false as const, message: "Luv's mapping assist isn't available for this type yet." };
  return proposeFieldMapping(headers, luvEntity);
}

export async function listMigrationSessionsAction() {
  return listSessionsForCurrentVenue();
}

export async function getMigrationSessionSummaryAction(sessionId: string) {
  return getOwnSessionSummary(sessionId);
}

export async function getMigrationSessionRecordsAction(sessionId: string, status?: string) {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const session = await repo.getSession(supabase, venue.id, sessionId);
  if (!session) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return repo.listRecords(supabase, sessionId, status as any);
}

export async function startMigrationSessionAction(sourceKey: SourceKey) {
  const result = await startSelfServiceSession(sourceKey);
  if (result.ok) revalidatePath("/settings/migration");
  return result;
}

export async function addMigrationRowsAction(sessionId: string, entityType: MigrationEntityType, rows: SourceRow[]) {
  const result = await addRowsToOwnSession(sessionId, entityType, rows);
  if (result.ok) revalidatePath("/settings/migration");
  return result;
}

export async function runMigrationDedupeAction(sessionId: string) {
  const result = await runDedupeForOwnSession(sessionId);
  if (result.ok) revalidatePath("/settings/migration");
  return result;
}

export async function reviewMigrationRecordAction(sessionId: string, recordId: string, decision: "approve" | "reject" | "approve_historical") {
  const result = await reviewOwnRecord(sessionId, recordId, decision);
  if (result.ok) revalidatePath("/settings/migration");
  return result;
}

export async function commitMigrationSessionAction(sessionId: string) {
  const result = await commitOwnSession(sessionId);
  if (result.ok) {
    revalidatePath("/settings/migration");
    revalidatePath("/clients");
    revalidatePath("/leads");
    revalidatePath("/vendors");
  }
  return result;
}

export async function attachMigrationSourceFileAction(
  sessionId: string,
  file: { fileName: string; fileSize: number; mimeType: string; storagePath: string; storageUrl: string },
) {
  const result = await attachSourceFileToOwnSession(sessionId, file);
  if (result.ok) revalidatePath("/settings/migration");
  return result;
}

export async function getMigrationSessionSourceFilesAction(sessionId: string) {
  return getOwnSessionSourceFiles(sessionId);
}

export async function getMigrationSessionResumeStateAction(sessionId: string) {
  return getOwnSessionResumeState(sessionId);
}

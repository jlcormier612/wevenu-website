"use server";

import { revalidatePath } from "next/cache";
import {
  addRowsToOwnSession,
  commitOwnSession,
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

export async function getSourceProfilesAction() {
  const supabase = await createClient();
  return getSourceProfiles(supabase);
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

export async function reviewMigrationRecordAction(sessionId: string, recordId: string, decision: "approve" | "reject") {
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

/**
 * Saved Reports application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/saved-reports/repository";
import type {
  CreateSavedReportResult, SavedReport, SavedReportActionResult, SavedReportInput, SavedReportSchedule,
} from "@/lib/saved-reports/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withUser<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, userId: string) => Promise<T>,
): Promise<T | SavedReportActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id, user.id);
}

export async function getSavedReports(): Promise<SavedReport[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getSavedReports(await createClient(), venue.id);
}

export async function getSavedReport(id: string): Promise<SavedReport | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getSavedReport(await createClient(), venue.id, id);
}

export async function getScheduleForReport(savedReportId: string): Promise<SavedReportSchedule | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getScheduleForReport(await createClient(), venue.id, savedReportId);
}

export async function createSavedReport(input: SavedReportInput): Promise<CreateSavedReportResult> {
  if (!input.name.trim()) return { ok: false, message: "Give this report a name." };
  const result = await withUser(async (supabase, venueId, userId) => {
    const savedReportId = await repo.insertSavedReport(supabase, venueId, userId, input);
    return { ok: true, savedReportId } as CreateSavedReportResult;
  });
  return result as CreateSavedReportResult;
}

export async function deleteSavedReport_(id: string): Promise<SavedReportActionResult> {
  const result = await withUser(async (supabase, venueId) => {
    await repo.deleteSavedReport(supabase, venueId, id);
    return { ok: true } as SavedReportActionResult;
  });
  return result as SavedReportActionResult;
}

export async function duplicateSavedReport_(id: string, newName: string): Promise<CreateSavedReportResult> {
  const result = await withUser(async (supabase, venueId, userId) => {
    const savedReportId = await repo.duplicateSavedReport(supabase, venueId, userId, id, newName);
    return { ok: true, savedReportId } as CreateSavedReportResult;
  });
  return result as CreateSavedReportResult;
}

/** Owner/Manager only — a deliberate call (brief §25): scheduling commits the venue to a recurring outbound email, closer in weight to other Owner/Manager-gated actions (template delete, contract delete) than to the low-stakes act of saving a personal view. */
export async function setSchedule(savedReportId: string, dayOfWeek: number, recipientEmail: string): Promise<SavedReportActionResult> {
  const result = await withUser(async (supabase, venueId, userId) => {
    const { getCurrentUserRole } = await import("@/lib/venue/service");
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can schedule a report." } as SavedReportActionResult;
    }
    if (!recipientEmail.trim()) return { ok: false, message: "An email address is required." } as SavedReportActionResult;
    await repo.upsertSchedule(supabase, venueId, userId, savedReportId, recipientEmail.trim(), dayOfWeek);
    return { ok: true } as SavedReportActionResult;
  });
  return result as SavedReportActionResult;
}

export async function removeSchedule(savedReportId: string): Promise<SavedReportActionResult> {
  const result = await withUser(async (supabase, venueId) => {
    await repo.deleteSchedule(supabase, venueId, savedReportId);
    return { ok: true } as SavedReportActionResult;
  });
  return result as SavedReportActionResult;
}

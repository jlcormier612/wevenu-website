/**
 * Saved Reports data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type { SavedReport, SavedReportInput, SavedReportPath, SavedReportSchedule } from "@/lib/saved-reports/types";
import type { DateRangePreset } from "@/lib/reporting/date-range";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type Row = {
  id: string; venue_id: string; created_by: string | null; name: string; report_path: string;
  date_preset: string; custom_from: string | null; custom_to: string | null;
  source_master_key: string | null; created_at: string; updated_at: string;
};
type ScheduleRow = {
  id: string; saved_report_id: string; venue_id: string; created_by: string | null;
  recipient_email: string; day_of_week: number; is_active: boolean; last_sent_at: string | null;
  created_at: string; updated_at: string;
};

const mapReport = (r: Row): SavedReport => ({
  id: r.id, venueId: r.venue_id, createdBy: r.created_by, name: r.name,
  reportPath: r.report_path as SavedReportPath, datePreset: r.date_preset as DateRangePreset,
  customFrom: r.custom_from, customTo: r.custom_to,
  sourceMasterKey: r.source_master_key ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapSchedule = (r: ScheduleRow): SavedReportSchedule => ({
  id: r.id, savedReportId: r.saved_report_id, venueId: r.venue_id, createdBy: r.created_by,
  recipientEmail: r.recipient_email, dayOfWeek: r.day_of_week, isActive: r.is_active,
  lastSentAt: r.last_sent_at, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function getSavedReports(client: DbClient, venueId: string): Promise<SavedReport[]> {
  const { data, error } = await client.from("saved_reports").select("*").eq("venue_id", venueId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(mapReport);
}

export async function getSavedReport(client: DbClient, venueId: string, id: string): Promise<SavedReport | null> {
  const { data, error } = await client.from("saved_reports").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<Row>();
  if (error) throw error;
  return data ? mapReport(data) : null;
}

export async function insertSavedReport(client: DbClient, venueId: string, userId: string, input: SavedReportInput): Promise<string> {
  const { data, error } = await client.from("saved_reports")
    .insert({
      venue_id: venueId, created_by: userId, name: input.name.trim(), report_path: input.reportPath,
      date_preset: input.datePreset,
      custom_from: input.datePreset === "custom" ? input.customFrom ?? null : null,
      custom_to: input.datePreset === "custom" ? input.customTo ?? null : null,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function deleteSavedReport(client: DbClient, venueId: string, id: string): Promise<void> {
  const { error } = await client.from("saved_reports").delete().eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

/** A fresh, independent copy — same "Duplicate" convention every other template/reusable-asset type in this codebase already uses (never carries the source's schedule). */
export async function duplicateSavedReport(client: DbClient, venueId: string, userId: string, sourceId: string, newName: string): Promise<string> {
  const source = await getSavedReport(client, venueId, sourceId);
  if (!source) throw new Error("Saved report not found.");
  return insertSavedReport(client, venueId, userId, {
    name: newName, reportPath: source.reportPath, datePreset: source.datePreset,
    customFrom: source.customFrom, customTo: source.customTo,
  });
}

export async function getScheduleForReport(client: DbClient, venueId: string, savedReportId: string): Promise<SavedReportSchedule | null> {
  const { data, error } = await client.from("saved_report_schedules").select("*").eq("saved_report_id", savedReportId).eq("venue_id", venueId).maybeSingle<ScheduleRow>();
  if (error) throw error;
  return data ? mapSchedule(data) : null;
}

export async function upsertSchedule(
  client: DbClient, venueId: string, userId: string, savedReportId: string, recipientEmail: string, dayOfWeek: number,
): Promise<void> {
  const existing = await getScheduleForReport(client, venueId, savedReportId);
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from("saved_report_schedules") as any)
      .update({ recipient_email: recipientEmail, day_of_week: dayOfWeek, is_active: true })
      .eq("id", existing.id).eq("venue_id", venueId);
    if (error) throw error;
    return;
  }
  const { error } = await client.from("saved_report_schedules")
    .insert({ saved_report_id: savedReportId, venue_id: venueId, created_by: userId, recipient_email: recipientEmail, day_of_week: dayOfWeek });
  if (error) throw error;
}

export async function setScheduleActive(client: DbClient, venueId: string, savedReportId: string, isActive: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("saved_report_schedules") as any)
    .update({ is_active: isActive }).eq("saved_report_id", savedReportId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteSchedule(client: DbClient, venueId: string, savedReportId: string): Promise<void> {
  const { error } = await client.from("saved_report_schedules").delete().eq("saved_report_id", savedReportId).eq("venue_id", venueId);
  if (error) throw error;
}

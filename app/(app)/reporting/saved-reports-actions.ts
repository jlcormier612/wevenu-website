"use server";

import { revalidatePath } from "next/cache";

import {
  createSavedReport, deleteSavedReport_, duplicateSavedReport_, removeSchedule, setSchedule,
} from "@/lib/saved-reports/service";
import type { CreateSavedReportResult, SavedReportActionResult, SavedReportInput } from "@/lib/saved-reports/types";

function revalidateSavedReports(id?: string) {
  revalidatePath("/reporting/saved");
  revalidatePath("/library");
  if (id) revalidatePath(`/reporting/saved/${id}`);
}

export async function createSavedReportAction(input: SavedReportInput): Promise<CreateSavedReportResult> {
  const result = await createSavedReport(input);
  if (result.ok) revalidateSavedReports();
  return result;
}

export async function deleteSavedReportAction(id: string): Promise<SavedReportActionResult> {
  const result = await deleteSavedReport_(id);
  if (result.ok) revalidateSavedReports();
  return result;
}

export async function duplicateSavedReportAction(id: string, newName: string): Promise<CreateSavedReportResult> {
  const result = await duplicateSavedReport_(id, newName);
  if (result.ok) revalidateSavedReports();
  return result;
}

export async function setScheduleAction(savedReportId: string, dayOfWeek: number, recipientEmail: string): Promise<SavedReportActionResult> {
  const result = await setSchedule(savedReportId, dayOfWeek, recipientEmail);
  if (result.ok) revalidateSavedReports(savedReportId);
  return result;
}

export async function removeScheduleAction(savedReportId: string): Promise<SavedReportActionResult> {
  const result = await removeSchedule(savedReportId);
  if (result.ok) revalidateSavedReports(savedReportId);
  return result;
}

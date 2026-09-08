"use server";

import { revalidatePath } from "next/cache";

import {
  archiveCustomScheduleItemType,
  createCustomScheduleItemType,
  restoreCustomScheduleItemType,
  updateBuiltinScheduleItemTypeSettings,
  updateCustomScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog-service";
import type { CustomScheduleItemKind } from "@/lib/calendar/schedule-item-catalog";

function revalidateCatalogPaths() {
  revalidatePath("/settings/availability");
  revalidatePath("/calendar");
}

export async function updateBuiltinScheduleItemTypeAction(input: {
  builtinKey: string;
  enabled?: boolean;
  blocksAvailability?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await updateBuiltinScheduleItemTypeSettings(input);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

export async function createCustomScheduleItemTypeAction(input: {
  label: string;
  kind: CustomScheduleItemKind;
  blocksAvailability?: boolean;
}): Promise<{ ok: true; id?: string } | { ok: false; message: string }> {
  const result = await createCustomScheduleItemType(input);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

export async function updateCustomScheduleItemTypeAction(input: {
  id: string;
  label?: string;
  blocksAvailability?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await updateCustomScheduleItemType(input);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

export async function archiveCustomScheduleItemTypeAction(input: {
  id: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await archiveCustomScheduleItemType(input);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

export async function restoreCustomScheduleItemTypeAction(input: {
  id: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await restoreCustomScheduleItemType(input);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

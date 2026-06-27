"use server";

import { revalidatePath } from "next/cache";

import {
  createPaymentSchedule,
  deletePaymentSchedule,
} from "@/lib/payments/service";
import type { CreateScheduleResult, PaymentActionResult, ScheduleInput } from "@/lib/payments/types";

export async function createScheduleAction(
  input: ScheduleInput,
  presetId?: string,
  eventDate?: string | null,
): Promise<CreateScheduleResult> {
  const result = await createPaymentSchedule(input, presetId, eventDate);
  if (result.ok) revalidatePath("/payments");
  return result;
}

export async function deleteScheduleAction(scheduleId: string): Promise<PaymentActionResult> {
  const result = await deletePaymentSchedule(scheduleId);
  if (result.ok) revalidatePath("/payments");
  return result;
}

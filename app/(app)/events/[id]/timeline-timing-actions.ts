"use server";

import { revalidatePath } from "next/cache";

import {
  confirmEventTimingRecalc,
  previewEventTimingRecalc,
  type TimingRecalcActionResult,
} from "@/lib/timeline/timing-recalc-service";

export async function previewEventTimingRecalcAction(input: {
  eventId: string;
  previousEventDate: string;
  previousEndDate: string | null;
  previousStartTime: string | null;
}): Promise<TimingRecalcActionResult> {
  return previewEventTimingRecalc(input);
}

export async function confirmEventTimingRecalcAction(input: {
  eventId: string;
  fingerprint: string;
  previousEventDate: string;
  previousEndDate: string | null;
  previousStartTime: string | null;
}): Promise<TimingRecalcActionResult> {
  const result = await confirmEventTimingRecalc(input);
  if (result.ok && "applied" in result) {
    revalidatePath(`/events/${input.eventId}`);
    revalidatePath("/events");
    revalidatePath("/clients");
  }
  return result;
}

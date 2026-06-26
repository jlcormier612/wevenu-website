"use server";

import { revalidatePath } from "next/cache";

import { createEvent } from "@/lib/events/service";
import type { CreateEventResult, EventInput } from "@/lib/events/types";

export async function createEventAction(input: EventInput): Promise<CreateEventResult> {
  const result = await createEvent(input);
  if (result.ok) { revalidatePath("/events"); revalidatePath("/clients"); }
  return result;
}

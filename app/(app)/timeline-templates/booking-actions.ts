"use server";

import { revalidatePath } from "next/cache";

import { applyTimelineTemplateToEvent } from "@/lib/timeline-templates/apply";
import type { TimelineActionResult } from "@/lib/timeline/types";

export async function applyTimelineTemplateAction(
  eventId: string, templateId: string, eventStartTime: string | null,
): Promise<TimelineActionResult> {
  const result = await applyTimelineTemplateToEvent(eventId, templateId, eventStartTime);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

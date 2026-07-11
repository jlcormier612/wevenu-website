/**
 * Scheduled Sends application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/scheduled-messages/repository";
import { getRelationshipIdForConversation } from "@/lib/conversations/repository";
import { validateScheduledMessageInput } from "@/lib/scheduled-messages/validation";
import type {
  ScheduleMessageResult, ScheduledMessage, ScheduledMessageActionResult, ScheduledMessageChannel,
} from "@/lib/scheduled-messages/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | ScheduledMessageActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function scheduleMessageForConversation(
  conversationId: string,
  templateId: string | null,
  channel: ScheduledMessageChannel,
  emailSubject: string,
  body: string,
  scheduledFor: string,
): Promise<ScheduleMessageResult> {
  const input = { relationshipId: "", templateId, channel, emailSubject, body, scheduledFor };
  const errors = validateScheduledMessageInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const result = await withVenue(async (supabase, venueId) => {
    const relationshipId = await getRelationshipIdForConversation(supabase, conversationId);
    if (!relationshipId) return { ok: false, message: "Couldn't find who this conversation belongs to." } as ScheduleMessageResult;
    const scheduledMessageId = await repo.insertScheduledMessage(supabase, venueId, { ...input, relationshipId });
    return { ok: true, scheduledMessageId } as ScheduleMessageResult;
  });
  return result as ScheduleMessageResult;
}

export async function getScheduledForConversation(conversationId: string): Promise<ScheduledMessage[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const relationshipId = await getRelationshipIdForConversation(supabase, conversationId);
  if (!relationshipId) return [];
  return repo.getScheduledForRelationship(supabase, venue.id, relationshipId);
}

export async function getScheduledCountForToday(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const venue = await getCurrentVenue();
  if (!venue) return 0;
  const supabase = await createClient();
  return repo.getScheduledCountForToday(supabase, venue.id);
}

export async function cancelScheduledMessage(id: string): Promise<ScheduledMessageActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.cancelScheduledMessage(supabase, venueId, id);
    return { ok: true } as ScheduledMessageActionResult;
  });
  return result as ScheduledMessageActionResult;
}

/**
 * Practice Run venue↔client messaging via the real conversation store.
 * Channel is portal (in-app only). External notify paths are practice-guarded.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendConversationMessage } from "@/lib/conversations/service";
import { findOrCreateVenueCoupleConversation } from "@/lib/conversations/venue-couple-conversation";
import * as practiceRepo from "@/lib/practice-run/repository";
import type { PracticeRun } from "@/lib/practice-run/types";
import { getCurrentVenue } from "@/lib/venue/service";

export type PracticeConversationMessage = {
  id: string;
  sender: "venue" | "client";
  body: string;
  sentAt: string;
};

export async function loadPracticeConversationMessages(
  run: PracticeRun,
): Promise<PracticeConversationMessage[]> {
  if (!isSupabaseConfigured || !run.sampleRelationshipId) return [];
  const client = await createClient();
  const conversationId = await findOrCreateVenueCoupleConversation(
    client,
    run.venueId,
    run.sampleRelationshipId,
  );
  if (!conversationId) return [];

  const { data, error } = await client
    .from("conversation_messages")
    .select("id, body, sender_type, channel, sent_at")
    .eq("conversation_id", conversationId)
    .eq("channel", "portal")
    .order("sent_at", { ascending: true })
    .limit(100);
  if (error || !data) return [];

  return (data as Array<{
    id: string;
    body: string;
    sender_type: string;
    sent_at: string;
  }>).map((row) => ({
    id: row.id,
    body: row.body,
    sentAt: row.sent_at,
    sender: row.sender_type === "venue_staff" || row.sender_type === "system" ? "venue" : "client",
  }));
}

export async function sendPracticeVenueMessage(input: {
  runId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Hello to Cheers is not connected." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Choose a venue to continue." };
  const client = await createClient();
  const run = await practiceRepo.getPracticeRunForVenue(client, venue.id, input.runId);
  if (!run || run.status !== "in_progress" || !run.sampleRelationshipId) {
    return { ok: false, message: "Practice Run not found for this venue." };
  }
  const text = input.body.trim();
  if (!text) return { ok: false, message: "Write a message before sending." };

  const conversationId = await findOrCreateVenueCoupleConversation(
    client,
    venue.id,
    run.sampleRelationshipId,
  );
  if (!conversationId) {
    return { ok: false, message: "Could not open the Practice Run conversation." };
  }

  const result = await sendConversationMessage(conversationId, text, "portal");
  if (!result.ok) return { ok: false, message: result.message ?? "Could not send the message." };
  return { ok: true };
}

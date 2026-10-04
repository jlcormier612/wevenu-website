/**
 * Staff-only conversation_messages projection for Internal Notes.
 * Does not change send/privacy semantics. Portal RPCs stay staff-channel-blind.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function loadConversationInternalNotes(
  conversationId: string | null | undefined,
): Promise<Array<{ id: string; body: string; sentAt: string }>> {
  if (!conversationId || !isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, body, sent_at")
    .eq("conversation_id", conversationId)
    .eq("channel", "internal_note")
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; body: string; sent_at: string }>).map((row) => ({
    id: row.id,
    body: row.body,
    sentAt: row.sent_at,
  }));
}

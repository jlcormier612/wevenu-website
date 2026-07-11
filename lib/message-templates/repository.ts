/**
 * Message Template Library data access layer. Server-only.
 * Mirrors lib/contracts/repository.ts's template functions.
 */
import { createClient } from "@/integrations/supabase/server";
import type { MessageTemplate, MessageTemplateInput } from "@/lib/message-templates/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = {
  id: string; venue_id: string; name: string; category: string;
  email_subject: string | null; email_body: string | null; sms_body: string | null;
  created_at: string; updated_at: string;
};

function mapTemplate(r: TemplateRow): MessageTemplate {
  return {
    id: r.id, venueId: r.venue_id, name: r.name,
    category: r.category as MessageTemplate["category"],
    emailSubject: r.email_subject, emailBody: r.email_body, smsBody: r.sms_body,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function getTemplates(client: DbClient, venueId: string): Promise<MessageTemplate[]> {
  const { data, error } = await client.from("message_templates").select("*")
    .eq("venue_id", venueId).order("category").order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function getTemplate(client: DbClient, venueId: string, id: string): Promise<MessageTemplate | null> {
  const { data, error } = await client.from("message_templates").select("*")
    .eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>();
  if (error) throw error;
  return data ? mapTemplate(data) : null;
}

export async function insertTemplate(client: DbClient, venueId: string, input: MessageTemplateInput): Promise<string> {
  const { data, error } = await client.from("message_templates")
    .insert({
      venue_id: venueId,
      name: input.name.trim(),
      category: input.category,
      email_subject: input.emailBody.trim() ? (input.emailSubject.trim() || null) : null,
      email_body: input.emailBody.trim() || null,
      sms_body: input.smsBody.trim() || null,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateTemplate(client: DbClient, venueId: string, id: string, input: MessageTemplateInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("message_templates") as any)
    .update({
      name: input.name.trim(),
      category: input.category,
      email_subject: input.emailBody.trim() ? (input.emailSubject.trim() || null) : null,
      email_body: input.emailBody.trim() || null,
      sms_body: input.smsBody.trim() || null,
    })
    .eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<void> {
  const { error } = await client.from("message_templates").delete().eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

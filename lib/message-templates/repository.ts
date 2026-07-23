/**
 * Message Template Library data access layer. Server-only.
 * Mirrors lib/contracts/repository.ts's template functions.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  MessageTemplate, MessageTemplateActionResult, MessageTemplateAttachment, MessageTemplateInput,
} from "@/lib/message-templates/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = {
  id: string; venue_id: string; name: string; category: string;
  email_subject: string | null; email_body: string | null; sms_body: string | null;
  is_archived: boolean;
  created_at: string; updated_at: string;
};

function mapTemplate(r: TemplateRow): MessageTemplate {
  return {
    id: r.id, venueId: r.venue_id, name: r.name,
    category: r.category as MessageTemplate["category"],
    emailSubject: r.email_subject, emailBody: r.email_body, smsBody: r.sms_body,
    isArchived: r.is_archived,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function getTemplates(client: DbClient, venueId: string, includeArchived = false): Promise<MessageTemplate[]> {
  let q = client.from("message_templates").select("*").eq("venue_id", venueId);
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("category").order("name");
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

// sequence_steps.template_id is `on delete restrict` on purpose (a template
// actively used by a live Automation step shouldn't silently disappear out
// from under it) — checked here so a coordinator gets a plain explanation
// instead of the raw foreign-key error the database itself would throw
// (Template Platform — Release Readiness, Release Blocker #1).
export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<MessageTemplateActionResult> {
  const { count } = await client
    .from("sequence_steps")
    .select("id", { count: "exact", head: true })
    .eq("template_id", id);
  if (count && count > 0) {
    return {
      ok: false,
      message: `This template is used in ${count} Automation step${count === 1 ? "" : "s"} — remove it from ${count === 1 ? "that step" : "those steps"} first.`,
    };
  }

  const { error } = await client.from("message_templates").delete().eq("id", id).eq("venue_id", venueId);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "This template is still in use elsewhere — remove it from there first." };
    }
    throw error;
  }
  return { ok: true };
}

export async function setTemplateArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("message_templates") as any)
    .update({ is_archived: isArchived }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

// Template Platform — Release Readiness: Duplicate, matching the identical
// pattern Playbooks/Timeline Templates/Floor Plan Templates already use — a
// fresh, independent, always-unarchived copy.
export async function duplicateTemplate(client: DbClient, venueId: string, sourceId: string, newName: string): Promise<string> {
  const source = await getTemplate(client, venueId, sourceId);
  if (!source) throw new Error("Template not found.");
  const newId = await insertTemplate(client, venueId, {
    name: newName,
    category: source.category,
    emailSubject: source.emailSubject ?? "",
    emailBody: source.emailBody ?? "",
    smsBody: source.smsBody ?? "",
  });
  await copyTemplateAttachments(client, venueId, sourceId, newId);
  return newId;
}

// ---- Attachments — an uploaded file, an existing venue document, or a web
// link (bug-report follow-up, 2026-07-22: "they'll also need to be able to
// attach things in these templates, like brochures, etc."). Mirrors
// lib/playbooks/repository.ts's playbook_task_attachments functions exactly.

type AttachmentRow = {
  id: string; template_id: string; document_id: string | null;
  link_url: string | null; link_label: string | null; sort_order: number; created_at: string;
};

export async function getTemplateAttachments(client: DbClient, venueId: string, templateId: string): Promise<MessageTemplateAttachment[]> {
  const { data, error } = await client.from("message_template_attachments")
    .select("id, template_id, document_id, link_url, link_label, sort_order, created_at")
    .eq("venue_id", venueId).eq("template_id", templateId)
    .order("sort_order").order("created_at");
  if (error) throw error;
  return resolveAttachmentRows(client, (data ?? []) as AttachmentRow[]);
}

async function resolveAttachmentRows(client: DbClient, rows: AttachmentRow[]): Promise<MessageTemplateAttachment[]> {
  if (!rows.length) return [];
  const documentIds = rows.map((r) => r.document_id).filter((v): v is string => !!v);
  const { data: documents } = documentIds.length
    ? await client.from("documents").select("id, name, file_name").in("id", documentIds)
    : { data: [] as { id: string; name: string; file_name: string }[] };
  const documentById = new Map((documents ?? []).map((d) => [d.id, d]));

  return rows.map((r): MessageTemplateAttachment => ({
    id: r.id, templateId: r.template_id, documentId: r.document_id,
    linkUrl: r.link_url, linkLabel: r.link_label, sortOrder: r.sort_order, createdAt: r.created_at,
    label: r.document_id ? (documentById.get(r.document_id)?.name || documentById.get(r.document_id)?.file_name || "Document") : (r.link_label || r.link_url || "Link"),
  }));
}

export async function addTemplateAttachment(
  client: DbClient, venueId: string, templateId: string,
  attachment: { documentId: string } | { linkUrl: string; linkLabel: string | null },
  sortOrder: number,
): Promise<void> {
  const row: Record<string, unknown> = { venue_id: venueId, template_id: templateId, sort_order: sortOrder };
  if ("documentId" in attachment) row.document_id = attachment.documentId;
  else { row.link_url = attachment.linkUrl; row.link_label = attachment.linkLabel?.trim() || null; }
  const { error } = await client.from("message_template_attachments").insert(row);
  if (error) throw error;
}

export async function removeTemplateAttachment(client: DbClient, venueId: string, attachmentId: string): Promise<void> {
  const { error } = await client.from("message_template_attachments").delete().eq("id", attachmentId).eq("venue_id", venueId);
  if (error) throw error;
}

async function copyTemplateAttachments(client: DbClient, venueId: string, sourceTemplateId: string, newTemplateId: string): Promise<void> {
  const attachments = await getTemplateAttachments(client, venueId, sourceTemplateId);
  for (const a of attachments) {
    await addTemplateAttachment(
      client, venueId, newTemplateId,
      a.documentId ? { documentId: a.documentId } : { linkUrl: a.linkUrl!, linkLabel: a.linkLabel },
      a.sortOrder,
    );
  }
}

/**
 * Load a White Glove material and turn it into a review proposal, or apply
 * an operator-confirmed proposal. Preview never writes product rows.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/documents/access";
import { extractDocxText, extractPdfText } from "@/lib/import/file-parsing";
import { resolveWgMaterialStoragePath } from "@/lib/onboarding/materials";
import {
  parseMessageTemplateSource,
  parsePlanningChecklist,
  type MessageImportProposal,
  type PlanningTaskProposal,
} from "@/lib/onboarding/white-glove-content-import";
import * as playbooks from "@/lib/playbooks/repository";
import type { PlaybookKind } from "@/lib/playbooks/types";

type MaterialRow = {
  id: string;
  venue_id: string;
  file_name: string;
  content_type: string | null;
  storage_path: string | null;
  public_url: string | null;
};

async function loadMaterialText(venueId: string, materialId: string): Promise<
  | { ok: true; text: string; fileName: string }
  | { ok: false; message: string }
> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("venue_onboarding_materials")
    .select("id, venue_id, file_name, content_type, storage_path, public_url")
    .eq("id", materialId)
    .maybeSingle<MaterialRow>();
  if (error) return { ok: false, message: error.message };
  if (!row || row.venue_id !== venueId) return { ok: false, message: "That file is not on this venue." };
  const storagePath = resolveWgMaterialStoragePath(row);
  const expectedPrefix = `onboarding/${row.venue_id}/`;
  if (!storagePath || !storagePath.startsWith(expectedPrefix)) {
    return { ok: false, message: "The uploaded file is not available to import." };
  }
  const downloaded = await admin.storage.from(DOCUMENTS_BUCKET).download(storagePath);
  if (downloaded.error || !downloaded.data) {
    return { ok: false, message: "The uploaded file could not be read. Nothing was imported." };
  }
  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  const name = row.file_name.toLowerCase();
  try {
    if (name.endsWith(".pdf") || row.content_type === "application/pdf") {
      const text = await extractPdfText(buffer);
      if (!text.trim()) {
        return {
          ok: false,
          message: "This PDF has no extractable text. It may be a scan or image. Nothing was imported.",
        };
      }
      return { ok: true, text, fileName: row.file_name };
    }
    if (name.endsWith(".docx")) {
      const text = await extractDocxText(buffer);
      if (!text.trim()) return { ok: false, message: "This Word file has no text. Nothing was imported." };
      return { ok: true, text, fileName: row.file_name };
    }
    if (/\.(txt|md|markdown|csv|json)$/.test(name) || (row.content_type ?? "").startsWith("text/")) {
      return { ok: true, text: buffer.toString("utf8"), fileName: row.file_name };
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "The file could not be read. Nothing was imported.",
    };
  }
  return {
    ok: false,
    message: "This file type cannot be imported as message templates or a planning checklist. Upload a .txt, .json, .md, .docx, or text-based PDF.",
  };
}

export async function previewWhiteGloveMaterial(
  venueId: string,
  materialId: string,
  kind: "messages" | "planning",
) {
  const loaded = await loadMaterialText(venueId, materialId);
  if (!loaded.ok) return loaded;
  if (kind === "messages") {
    const parsed = parseMessageTemplateSource(loaded.text);
    if (!parsed.ok) return parsed;
    return {
      ok: true as const,
      fileName: loaded.fileName,
      kind,
      proposals: parsed.proposals,
      notes: parsed.notes,
    };
  }
  const parsed = parsePlanningChecklist(loaded.text);
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    fileName: loaded.fileName,
    kind,
    tasks: parsed.tasks,
    notes: parsed.notes,
  };
}

export type MessageApplyResult = {
  created: { id: string; name: string }[];
  skipped: { name: string; reason: string }[];
  rejected: { name: string; reason: string }[];
};

function sameText(a: string | null, b: string): boolean {
  return (a ?? "").trim() === b.trim();
}

export async function applyMessageTemplateImport(
  venueId: string,
  proposals: MessageImportProposal[],
): Promise<MessageApplyResult> {
  const admin = createAdminClient();
  const { data: existing, error } = await admin
    .from("message_templates")
    .select("id, name, email_subject, email_body, sms_body")
    .eq("venue_id", venueId);
  if (error) throw error;
  const rows = existing ?? [];
  const result: MessageApplyResult = { created: [], skipped: [], rejected: [] };
  for (const proposal of proposals) {
    if (!proposal.include) {
      result.skipped.push({ name: proposal.name, reason: "Excluded in review." });
      continue;
    }
    if (!proposal.name.trim() || (!proposal.emailBody.trim() && !proposal.smsBody.trim())) {
      result.rejected.push({ name: proposal.name || "(unnamed)", reason: "A name and a body are required." });
      continue;
    }
    const match = rows.find((r) => r.name.trim().toLowerCase() === proposal.name.trim().toLowerCase());
    if (match) {
      const identical = sameText(match.email_subject, proposal.emailSubject)
        && sameText(match.email_body, proposal.emailBody)
        && sameText(match.sms_body, proposal.smsBody);
      if (identical) result.skipped.push({ name: proposal.name, reason: "Already imported. Not duplicated." });
      else result.rejected.push({ name: proposal.name, reason: "A template with this name already exists and was not overwritten." });
      continue;
    }
    const { data: inserted, error: insertError } = await admin
      .from("message_templates")
      .insert({
        venue_id: venueId,
        name: proposal.name.trim(),
        category: proposal.category,
        email_subject: proposal.emailBody.trim() ? (proposal.emailSubject.trim() || null) : null,
        email_body: proposal.emailBody.trim() || null,
        sms_body: proposal.smsBody.trim() || null,
      })
      .select("id")
      .single<{ id: string }>();
    if (insertError || !inserted) {
      result.rejected.push({ name: proposal.name, reason: insertError?.message ?? "Could not save." });
      continue;
    }
    result.created.push({ id: inserted.id, name: proposal.name.trim() });
    rows.push({
      id: inserted.id,
      name: proposal.name.trim(),
      email_subject: proposal.emailSubject,
      email_body: proposal.emailBody,
      sms_body: proposal.smsBody,
    });
  }
  return result;
}

export async function applyPlanningImport(
  venueId: string,
  input: { templateName: string; kind: PlaybookKind; tasks: PlanningTaskProposal[] },
): Promise<
  | { ok: true; duplicate: true; templateId: string }
  | { ok: true; duplicate: false; templateId: string; created: number; excluded: number }
  | { ok: false; message: string }
> {
  const included = input.tasks.filter((t) => t.include);
  const missingTiming = included.filter((t) => t.daysOffset == null || !Number.isFinite(t.daysOffset));
  if (!input.templateName.trim()) return { ok: false, message: "Name the planning template before applying." };
  if (included.length === 0) return { ok: false, message: "No items are included. Nothing was applied." };
  if (missingTiming.length > 0) {
    return {
      ok: false,
      message: `Set a timing or exclude these items before applying: ${missingTiming.map((t) => t.title).join("; ")}. Dates are not invented.`,
    };
  }
  const admin = createAdminClient();
  const { data: existing, error } = await admin
    .from("playbook_templates")
    .select("id, name")
    .eq("venue_id", venueId)
    .eq("is_archived", false);
  if (error) return { ok: false, message: error.message };
  const dup = (existing ?? []).find((t) => t.name.trim().toLowerCase() === input.templateName.trim().toLowerCase());
  if (dup) return { ok: true, duplicate: true, templateId: dup.id };

  const templateId = await playbooks.insertTemplate(
    admin as never,
    venueId,
    input.templateName.trim(),
    input.kind,
    null,
    "Imported from a White Glove planning document after operator review.",
  );
  const milestoneIds = new Map<string, string>();
  let sort = 0;
  let created = 0;
  for (const task of included) {
    let milestoneId = milestoneIds.get(task.milestone);
    if (!milestoneId) {
      milestoneId = await playbooks.insertMilestone(
        admin as never,
        venueId,
        templateId,
        task.milestone || "Imported",
        milestoneIds.size,
      );
      milestoneIds.set(task.milestone, milestoneId);
    }
    await playbooks.insertTemplateTask(admin as never, venueId, templateId, {
      title: task.title,
      description: task.instructions.trim() || null,
      ownerType: input.kind === "client" ? "couple" : "coordinator",
      visibility: input.kind === "client" ? "client_owned" : "coordinator_only",
      daysOffset: task.daysOffset as number,
      dueDateRuleKind: "relative_to_event",
      category: "planning",
      milestoneId,
      autoCompleteTrigger: null,
      dependsOnTaskId: null,
      isRequired: true,
      sortOrder: sort,
      reminderBeforeDays: null,
      escalationAfterDays: null,
      notifyOnAssign: false,
      notifyOnComplete: false,
      actionType: null,
      actionLabel: null,
      needsReview: !task.timingKnown,
    });
    sort += 1;
    created += 1;
  }
  return {
    ok: true,
    duplicate: false,
    templateId,
    created,
    excluded: input.tasks.length - included.length,
  };
}

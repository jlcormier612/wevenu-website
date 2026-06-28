"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import {
  buildContractMergeData,
  cancelContract,
  createContract,
  createTemplate,
  deleteContract_,
  deleteTemplate_,
  mergeContent,
  sendContract,
  updateContractContent_,
  updateTemplate_,
} from "@/lib/contracts/service";
import type {
  ContractActionResult,
  ContractErrors,
  CreateContractResult,
  CreateTemplateResult,
  NewContractInput,
  TemplateInput,
} from "@/lib/contracts/types";

// ---- templates --------------------------------------------------------------

export async function createTemplateAction(input: TemplateInput): Promise<CreateTemplateResult> {
  const result = await createTemplate(input);
  if (result.ok) revalidatePath("/contracts/templates");
  return result;
}

export async function updateTemplateAction(id: string, input: TemplateInput): Promise<ContractActionResult> {
  const result = await updateTemplate_(id, input);
  if (result.ok) { revalidatePath(`/contracts/templates/${id}/edit`); revalidatePath("/contracts/templates"); }
  return result;
}

export async function deleteTemplateAction(id: string): Promise<ContractActionResult> {
  const result = await deleteTemplate_(id);
  if (result.ok) revalidatePath("/contracts/templates");
  return result;
}

// ---- contracts --------------------------------------------------------------

export async function createContractAction(input: NewContractInput): Promise<CreateContractResult> {
  const result = await createContract(input);
  if (result.ok) revalidatePath("/contracts");
  return result;
}

/** Resolve merge fields for a template given client/event selection. */
export async function previewMergedContentAction(opts: {
  templateContent: string;
  clientId: string;
  eventId: string;
  contractTitle: string;
}): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
  try {
    const data = await buildContractMergeData({
      clientId: opts.clientId,
      eventId: opts.eventId,
      contractTitle: opts.contractTitle,
    });
    return { ok: true, content: mergeContent(opts.templateContent, data) };
  } catch {
    return { ok: false, message: "Could not preview contract." };
  }
}

/** Find the lead linked to a contract (via client) and refresh their scores. */
async function refreshContractLeadScore(contractId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("contracts")
      .select("client_id").eq("id", contractId).maybeSingle<{ client_id: string | null }>();
    if (!data?.client_id) return;
    const { data: client } = await supabase.from("clients")
      .select("lead_id").eq("id", data.client_id).maybeSingle<{ lead_id: string | null }>();
    if (!client?.lead_id) return;
    const { refreshLeadScore } = await import("@/lib/leads/scores");
    await refreshLeadScore(client.lead_id);
  } catch { /* non-blocking */ }
}

export async function sendContractAction(id: string): Promise<ContractActionResult> {
  const result = await sendContract(id);
  if (result.ok) {
    revalidatePath(`/contracts/${id}`);
    void refreshContractLeadScore(id);
  }
  return result;
}

export async function updateContractContentAction(id: string, title: string, content: string): Promise<ContractActionResult> {
  const result = await updateContractContent_(id, title, content);
  if (result.ok) revalidatePath(`/contracts/${id}`);
  return result;
}

export async function cancelContractAction(id: string): Promise<ContractActionResult> {
  const result = await cancelContract(id);
  if (result.ok) { revalidatePath(`/contracts/${id}`); revalidatePath("/contracts"); }
  return result;
}

export async function deleteContractAction(id: string): Promise<ContractActionResult> {
  const result = await deleteContract_(id);
  if (result.ok) revalidatePath("/contracts");
  return result;
}

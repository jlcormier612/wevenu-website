/**
 * Contracts application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/contracts/repository";
import * as documentIntegration from "@/lib/contracts/document-integration";
import { buildMergeData, mergeContent } from "@/lib/contracts/merge";
import { recordEngagementEvent } from "@/lib/activation/service";
import type {
  Contract,
  ContractActionResult,
  ContractTemplate,
  ContractWithDetails,
  CreateContractResult,
  CreateTemplateResult,
  NewContractInput,
  TemplateInput,
} from "@/lib/contracts/types";
import {
  validateNewContractInput,
  validateTemplateInput,
} from "@/lib/contracts/validation";
import { getClient } from "@/lib/clients/service";
import { getEvent } from "@/lib/events/service";
import { getCurrentVenue, getCurrentUserRole } from "@/lib/venue/service";
import { sendEmail } from "@/lib/email/send";
import {
  buildContractInviteSubject,
  buildContractInviteText,
  buildContractInviteHtml,
} from "@/lib/email/contract-invite";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | ContractActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- templates --------------------------------------------------------------

export async function getTemplates(includeArchived = false): Promise<ContractTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id, includeArchived);
}

export async function getTemplate(id: string): Promise<ContractTemplate | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplate(await createClient(), venue.id, id);
}

export async function createTemplate(input: TemplateInput): Promise<CreateTemplateResult> {
  const errors = validateTemplateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, input);
    return { ok: true, templateId } as CreateTemplateResult;
  });
  return result as CreateTemplateResult;
}

export async function updateTemplate_(id: string, input: TemplateInput): Promise<ContractActionResult> {
  const errors = validateTemplateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateTemplate(supabase, venueId, id, input);
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function deleteTemplate_(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteTemplate(supabase, venueId, id);
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function setTemplateArchived_(id: string, isArchived: boolean): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setTemplateArchived(supabase, venueId, id, isArchived);
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function duplicateTemplate_(id: string, newName: string): Promise<CreateTemplateResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.duplicateTemplate(supabase, venueId, id, newName);
    return { ok: true, templateId } as CreateTemplateResult;
  });
  return result as CreateTemplateResult;
}

// ---- contracts --------------------------------------------------------------

export async function getContracts(): Promise<Contract[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getContracts(await createClient(), venue.id);
}

export async function getContractDetail(id: string): Promise<ContractWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getContract(await createClient(), venue.id, id);
}

/** Get a contract by its public sign_token (no auth required). */
export async function getContractByToken(token: string): Promise<Contract | null> {
  if (!isSupabaseConfigured) return null;
  return repo.getContractByToken(await createClient(), token);
}

/**
 * Generate a contract from a template + client/event.
 * Merges all available fields from the client, event, and venue.
 */
export async function createContract(input: NewContractInput): Promise<CreateContractResult> {
  const errors = validateNewContractInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const contractId = await repo.insertContract(supabase, venueId, input);
    await repo.insertContractActivity(supabase, venueId, contractId, "contract_created", "Contract created");
    return { ok: true, contractId } as CreateContractResult;
  });
  return result as CreateContractResult;
}

/**
 * Work Package D4, Step 33 — "Create Amendment," not "Edit Final
 * Contract." Only legal from a truly finalized contract (Document Domain
 * status='finalized', not merely Contract status='signed' — matches
 * Step 33's own framing: "A finalized Contract must be preservable").
 * Clones title/client/event/content into a brand-new draft `contracts`
 * row and a brand-new canonical Document — the original row, its
 * signature, and its finalized PDF are never touched. Lineage back to
 * the original is recorded immediately (recordAmendmentLineage); the
 * original doesn't actually become `superseded` until the amendment
 * itself is later finalized (see finalizeContractDocument).
 */
export async function createAmendmentFromContract(sourceContractId: string): Promise<CreateContractResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const source = await repo.getContract(supabase, venueId, sourceContractId);
    if (!source) return { ok: false, message: "Original contract not found." } as CreateContractResult;

    const finalized = await documentIntegration.isContractFinalized(supabase, sourceContractId);
    if (!finalized) {
      return { ok: false, message: "Only a finalized contract can be amended." } as CreateContractResult;
    }

    // Document Domain lineage isn't recorded yet — the amendment has no
    // canonical Document until it's actually sent (publishing happens in
    // sendContract, same as any other contract's first send). The
    // amends_contract_id column is what lets the UI show "this amends X"
    // immediately, before that Document exists; sendContract reads this
    // same column to record the Document Domain lineage once it can.
    const newContractId = await repo.insertContract(supabase, venueId, {
      templateId: source.templateId ?? "",
      clientId: source.clientId ?? "",
      eventId: source.eventId ?? "",
      title: `${source.title} — Amendment`,
      content: source.content,
      amendsContractId: sourceContractId,
    });
    await repo.insertContractActivity(supabase, venueId, newContractId, "contract_created", `Amendment of "${source.title}" created`);

    return { ok: true, contractId: newContractId } as CreateContractResult;
  });
  return result as CreateContractResult;
}

/** Build merge data from the current venue + client + event. */
export async function buildContractMergeData(opts: {
  clientId?: string;
  eventId?: string;
  contractTitle?: string;
}): Promise<Record<string, string>> {
  const [venue, client, event] = await Promise.all([
    getCurrentVenue(),
    opts.clientId ? getClient(opts.clientId) : Promise.resolve(null),
    opts.eventId ? getEvent(opts.eventId) : Promise.resolve(null),
  ]);
  return buildMergeData({
    venueName: venue?.name ?? "",
    clientFirstName: client?.firstName ?? "",
    clientLastName: client?.lastName ?? "",
    partnerFirstName: client?.partnerFirstName ?? null,
    partnerLastName: client?.partnerLastName ?? null,
    eventDate: event?.eventDate ?? client?.eventDate ?? null,
    eventType: event?.eventType ?? client?.eventType ?? null,
    guestCount: event?.guestCount ?? client?.guestCount ?? null,
    contractTitle: opts.contractTitle ?? "",
  });
}

export async function updateContractContent_(id: string, title: string, content: string, expectedUpdatedAt: string): Promise<ContractActionResult> {
  if (!title.trim() || !content.trim()) return { ok: false, message: "Title and content are required." };
  const result = await withVenue(async (supabase, venueId) => {
    const outcome = await repo.updateContractContent(supabase, venueId, id, title, content, expectedUpdatedAt);
    if (!outcome.ok) return { ok: false, message: outcome.message, reason: outcome.reason } as ContractActionResult;
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function sendContract(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const contract = await repo.getContract(supabase, venueId, id);
    const outcome = await repo.updateContractStatus(supabase, venueId, id, "sent", { sentAt: true });
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    await repo.insertContractActivity(supabase, venueId, id, "sent", "Contract sent for signing");

    // Work Package D4 — Document Domain integration. First send publishes
    // the Contract into the Document Domain; every later send (after a
    // reopen + edit) is a new, real version boundary — never a version
    // per keystroke, only per actual reshare.
    if (contract) {
      const existingDocumentId = await documentIntegration.getContractDocumentId(supabase, id);
      if (!existingDocumentId) {
        const { documentId: newDocumentId } = await documentIntegration.publishContractDocument(supabase, contract);
        // If this contract is an amendment (amends_contract_id set at
        // creation, Step 33/34), this is the first moment a canonical
        // Document exists for it — record the lineage now, same fact the
        // amends_contract_id column already carries, in the certified
        // Document Domain vocabulary too.
        if (contract.amendsContractId) {
          const priorDocumentId = await documentIntegration.getContractDocumentId(supabase, contract.amendsContractId);
          if (priorDocumentId) {
            await documentIntegration.recordAmendmentLineage(supabase, newDocumentId, priorDocumentId);
          }
        }
      } else {
        await documentIntegration.versionContractDocument(supabase, existingDocumentId, contract.content, { type: "venue", id: venueId });
      }
    }

    if (contract?.clientId) {
      const [client, venue] = await Promise.all([getClient(contract.clientId), getCurrentVenue()]);
      if (client?.email && venue) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
        const signUrl = `${baseUrl}/sign/${contract.signToken}`;
        const brand = {
          name: venue.name ?? "Your venue",
          logoUrl: venue.logoUrl,
          primaryColor: venue.primaryColor,
        };
        const ctx = {
          brand,
          recipientFirstName: client.firstName,
          contractTitle: contract.title,
          signUrl,
        };
        await sendEmail({
          to: client.email,
          subject: buildContractInviteSubject(ctx),
          text: buildContractInviteText(ctx),
          html: buildContractInviteHtml(ctx),
        });
      }
    }

    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function cancelContract(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const outcome = await repo.updateContractStatus(supabase, venueId, id, "cancelled");
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    await repo.insertContractActivity(supabase, venueId, id, "cancelled", "Contract cancelled");
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

/** Work Package D4 — closes the negotiation-loop gap; see repository.ts's own comment on reopenForEditing. */
export async function reopenContractForEditing(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const outcome = await repo.reopenForEditing(supabase, venueId, id);
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function deleteContract_(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can delete a contract." } as ContractActionResult;
    }
    const outcome = await repo.deleteContract(supabase, venueId, id);
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

/** Public action — signs via the SECURITY DEFINER RPC (no venue auth needed). */
export async function signContractByToken(
  token: string,
  signerName: string,
  consent: boolean,
): Promise<{ ok: boolean; message?: string; clientId?: string | null; celebrated?: boolean }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!signerName.trim()) return { ok: false, message: "Please enter your full name." };
  if (!consent) return { ok: false, message: "Please confirm you agree this constitutes your legal signature." };
  const supabase = await createClient();

  const { headers } = await import("next/headers");
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const userAgent = headerList.get("user-agent");

  // Look up venue_id/event_id/client_id before signing so we can fire the
  // engagement event and the "contract signed" playbook trigger — this is
  // the one place that should ever fire it (TR-L4: it previously fired on
  // send, not on signature). Goes through the token-validating RPC (TR-L6),
  // not a direct table read.
  const contractRow = await repo.getContractByToken(supabase, token);

  const { data, error } = await supabase.rpc("sign_contract", {
    p_token: token,
    p_signer: signerName.trim(),
    p_ip: ip,
    p_user_agent: userAgent,
    p_consent: consent,
  });
  if (error) return { ok: false, message: error.message };
  const result = data as { ok: boolean; celebrated?: boolean } | null;
  if (!result?.ok) return { ok: false, message: "This contract is not available for signing." };

  if (contractRow?.venueId) {
    void recordEngagementEvent({
      venueId:   contractRow.venueId,
      eventType: "contract.signed",
      actorType: "couple",
      entityType: "contract",
      entityId:  contractRow.id,
    });

    // The couple has no venue_staff session here, so use the admin client —
    // the RPC above already validated the token and flipped status to signed.
    if (contractRow.eventId) {
      const { triggerAutoComplete } = await import("@/lib/playbooks/service");
      const admin = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await triggerAutoComplete(admin as any, contractRow.venueId, contractRow.eventId, "contract_signed");
    }
  }

  return { ok: true, clientId: contractRow?.clientId ?? null, celebrated: result.celebrated === true };
}

export { mergeContent };

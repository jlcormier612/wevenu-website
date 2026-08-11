/**
 * Contracts application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/contracts/repository";
import * as documentIntegration from "@/lib/contracts/document-integration";
import { buildMergeData, mergeContent, extractTokens, assertCustomerSafeContractContent } from "@/lib/contracts/merge";
import { getSpaces } from "@/lib/availability/service";
import { getEventOrder } from "@/lib/event-orders/service";
import { getPaymentSchedules, getPaymentSchedule } from "@/lib/payments/service";
import { computeTotalPaid } from "@/lib/payments/constants";
import { formatContractDate } from "@/lib/contracts/constants";
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
  const result = await withVenue(async (supabase, venueId) => repo.deleteTemplate(supabase, venueId, id));
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
    const mergeData = await buildContractMergeData({
      clientId: input.clientId, eventId: input.eventId, contractTitle: input.title,
    });
    const resolvedContent = mergeContent(input.content, mergeData);
    // Drafts may still hold venue-policy placeholders (filled before send).
    // Unresolved {{tokens}} must never land in a working contract.
    const leftover = extractTokens(resolvedContent);
    if (leftover.length > 0) {
      return {
        ok: false,
        message: `Some details couldn't be filled in yet: ${leftover.map((t) => `{{${t}}}`).join(", ")}. Check the booking, client, and event, or remove those tokens before creating the agreement.`,
      } as CreateContractResult;
    }
    const contractId = await repo.insertContract(supabase, venueId, { ...input, content: resolvedContent });
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

/** Build merge data from the current venue + client + event + booking domains. */
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

  const addressParts = [
    venue?.addressLine1,
    venue?.addressLine2,
    [venue?.city, venue?.stateRegion].filter(Boolean).join(", "),
    venue?.postalCode,
  ].filter((p) => p && String(p).trim());
  const venueAddress = addressParts.length > 0 ? addressParts.join("\n") : null;

  let eventSpaces = "No event spaces are listed on this booking yet.";
  let venueAccessHours = "Event hours will follow your booking and Timeline.";
  let ceremonySummary = "No separate ceremony details are listed on this booking yet.";
  let receptionSummary = "No separate reception details are listed on this booking yet.";
  let packageSection = "No package is currently selected for this booking.";
  let includedItemsSummary = "No included items are listed on this booking yet.";
  let additionalItemsSummary = "No additional or optional items are listed on this booking yet.";
  let paymentScheduleSummary = "No payment schedule is on file for this celebration yet.";
  let contractTotal: string | null = null;
  let balanceRemaining: string | null = null;
  let vendorsOnFile = "No vendors are currently listed for this celebration.";
  let coordinatorName: string | null = null;

  if (venue) {
    try {
      const details = await (await import("@/lib/venue/repository")).getVenueFullDetails(await createClient());
      if (details?.ownerName?.trim()) coordinatorName = details.ownerName.trim();
    } catch { /* optional */ }
  }

  if (event) {
    const fmtTime = (t: string | null) => {
      if (!t) return null;
      const [h, m] = t.split(":");
      const hour = Number(h);
      const ampm = hour >= 12 ? "PM" : "AM";
      const h12 = ((hour + 11) % 12) + 1;
      return `${h12}:${m ?? "00"} ${ampm}`;
    };
    const start = fmtTime(event.startTime);
    const end = fmtTime(event.endTime);
    if (start || end) {
      venueAccessHours = [start ? `Start ${start}` : null, end ? `End ${end}` : null].filter(Boolean).join(" · ");
    }
    if (event.setupTime || event.teardownTime) {
      const setup = fmtTime(event.setupTime);
      const tear = fmtTime(event.teardownTime);
      const extra = [setup ? `Setup from ${setup}` : null, tear ? `Teardown by ${tear}` : null].filter(Boolean).join(" · ");
      if (extra) {
        venueAccessHours = venueAccessHours.includes("Start") || venueAccessHours.includes("End")
          ? `${venueAccessHours}\n${extra}`
          : extra;
      }
    }

    try {
      const spaces = await getSpaces();
      const space = event.spaceId ? spaces.find((s) => s.id === event.spaceId) : null;
      if (space?.name) eventSpaces = space.name;
    } catch { /* optional */ }

    try {
      const order = await getEventOrder(event.id);
      if (order?.lines?.length) {
        const packageLines = order.lines.filter((l) => l.provenance === "package");
        const included = order.lines.filter((l) => l.provenance === "package" || l.provenance === "inventory");
        const additional = order.lines.filter((l) => l.provenance === "custom");
        if (packageLines.length > 0) {
          const names = [...new Set(packageLines.map((l) => l.description))];
          packageSection = `Selected package / services:\n${names.map((n) => `• ${n}`).join("\n")}`;
        }
        if (included.length > 0) {
          includedItemsSummary = included.map((l) => `• ${l.description}${l.quantity ? ` × ${l.quantity}` : ""}`).join("\n");
        }
        if (additional.length > 0) {
          additionalItemsSummary = additional.map((l) => `• ${l.description}${l.quantity ? ` × ${l.quantity}` : ""}`).join("\n");
        }
      }
    } catch { /* Event Order may be disabled */ }

    try {
      const schedules = await getPaymentSchedules();
      const forEvent = schedules.filter((s) => s.eventId === event.id);
      if (forEvent.length > 0) {
        const detail = await getPaymentSchedule(forEvent[0].id);
        if (detail) {
          const currency = detail.currency || "USD";
          const fmt = (n: number) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
          paymentScheduleSummary = detail.lineItems
            .map((li) => {
              const due = li.dueDate ? formatContractDate(li.dueDate) : "Date TBD";
              return `• ${li.label}: ${fmt(li.amount)} — due ${due}${li.status === "paid" ? " (paid)" : ""}`;
            })
            .join("\n");
          contractTotal = fmt(detail.totalAmount);
          const paid = computeTotalPaid(detail.lineItems);
          balanceRemaining = fmt(Math.max(0, detail.totalAmount - paid));
        }
      }
    } catch { /* optional */ }

    try {
      const supabase = await createClient();
      const { data: assignments } = await supabase.from("event_vendor_assignments")
        .select("role, vendors(name)")
        .eq("event_id", event.id)
        .eq("venue_id", event.venueId);
      const rows = (assignments ?? []) as { role?: string | null; vendors?: { name?: string } | null }[];
      if (rows.length > 0) {
        vendorsOnFile = rows
          .map((a) => `• ${a.vendors?.name ?? "Vendor"}${a.role ? ` — ${a.role}` : ""}`)
          .join("\n");
      }
    } catch { /* optional */ }

    try {
      const supabase = await createClient();
      const { data: q } = await supabase.from("event_questionnaires")
        .select("ceremony_start_time, ceremony_location, reception_start_time, reception_location")
        .eq("event_id", event.id).eq("kind", "final_details").maybeSingle<{
          ceremony_start_time: string | null; ceremony_location: string | null;
          reception_start_time: string | null; reception_location: string | null;
        }>();
      if (q) {
        const cer = [q.ceremony_location, q.ceremony_start_time].filter(Boolean).join(" · ");
        const rec = [q.reception_location, q.reception_start_time].filter(Boolean).join(" · ");
        if (cer) ceremonySummary = cer;
        if (rec) receptionSummary = rec;
      }
    } catch { /* optional */ }
  }

  return buildMergeData({
    venueName: venue?.name ?? "",
    venueAddress: venueAddress ?? "Address on file with the venue",
    venuePhone: venue?.phone?.trim() || "Phone on file with the venue",
    venueEmail: venue?.email?.trim() || "Email on file with the venue",
    clientFirstName: client?.firstName ?? "",
    clientLastName: client?.lastName ?? "",
    partnerFirstName: client?.partnerFirstName ?? null,
    partnerLastName: client?.partnerLastName ?? null,
    clientEmail: client?.email?.trim() || "Email on the client record",
    clientPhone: client?.phone?.trim() || "Phone on the client record",
    eventName: event?.name || "Your celebration",
    eventDate: event?.eventDate ?? client?.eventDate ?? null,
    eventType: event?.eventType ?? client?.eventType ?? null,
    guestCount: event?.guestCount ?? client?.guestCount ?? null,
    eventSpaces,
    coordinatorName: coordinatorName || "Your venue team",
    venueAccessHours,
    ceremonySummary,
    receptionSummary,
    packageSection,
    includedItemsSummary,
    additionalItemsSummary,
    paymentScheduleSummary,
    contractTotal: contractTotal ?? "See payment schedule",
    balanceRemaining: balanceRemaining ?? "See payment schedule",
    vendorsOnFile,
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

/** Shared by sendContract (first send) and resendContract (D5E) — the actual invite email. */
async function sendContractInviteEmail(contract: ContractWithDetails, customMessage?: string): Promise<void> {
  if (!contract.clientId) return;
  const [client, venue] = await Promise.all([getClient(contract.clientId), getCurrentVenue()]);
  if (!client?.email || !venue) return;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
  const signUrl = `${baseUrl}/sign/${contract.signToken}`;
  const brand = { name: venue.name ?? "Your venue", logoUrl: venue.logoUrl, primaryColor: venue.primaryColor };
  const ctx = { brand, recipientFirstName: client.firstName, contractTitle: contract.title, signUrl, customMessage };
  await sendEmail({
    to: client.email,
    subject: buildContractInviteSubject(ctx),
    text: buildContractInviteText(ctx),
    html: buildContractInviteHtml(ctx),
  });
}

export async function sendContract(id: string, customMessage?: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const contract = await repo.getContract(supabase, venueId, id);
    if (!contract) return { ok: false, message: "Contract not found." } as ContractActionResult;

    // Re-merge any tokens that may have been pasted after create, then refuse
    // customer send when unresolved tokens or starter policy placeholders remain.
    let content = contract.content;
    if (extractTokens(content).length > 0) {
      const mergeData = await buildContractMergeData({
        clientId: contract.clientId ?? undefined,
        eventId: contract.eventId ?? undefined,
        contractTitle: contract.title,
      });
      content = mergeContent(content, mergeData);
      await repo.forceResolveContractContent(supabase, venueId, id, content);
      contract.content = content;
    }

    const safety = assertCustomerSafeContractContent(content);
    if (!safety.ok) {
      return { ok: false, message: safety.message } as ContractActionResult;
    }

    const outcome = await repo.updateContractStatus(supabase, venueId, id, "sent", { sentAt: true });
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    await repo.insertContractActivity(supabase, venueId, id, "sent", "Contract sent for signing");

    // Work Package D4 — Document Domain integration.
    {
      const existingDocumentId = await documentIntegration.getContractDocumentId(supabase, id);
      if (!existingDocumentId) {
        const { documentId: newDocumentId } = await documentIntegration.publishContractDocument(supabase, contract);
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

    await sendContractInviteEmail(contract, customMessage);

    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

/**
 * Work Package D5E — "Resend" for a contract already `sent` and still
 * awaiting signature (brief Step 11): "another delivery of the same
 * working contract, not creation of a new contract." Unlike sendContract(),
 * this never touches status or the Document Domain — nothing about the
 * contract changed, so there's nothing to re-publish or version. Just the
 * email, again, plus its own activity entry.
 */
export async function resendContract(id: string, customMessage?: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const contract = await repo.getContract(supabase, venueId, id);
    if (!contract) return { ok: false, message: "Contract not found." } as ContractActionResult;
    if (contract.status !== "sent") {
      return { ok: false, message: "Only a contract that's already been sent and is still awaiting signature can be resent." } as ContractActionResult;
    }
    await sendContractInviteEmail(contract, customMessage);
    await repo.insertContractActivity(supabase, venueId, id, "resent", "Contract resent for signing");
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

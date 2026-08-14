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
import { getClientContacts } from "@/lib/contacts/service";
import { getEvent } from "@/lib/events/service";
import { getCurrentVenue, getCurrentUserRole } from "@/lib/venue/service";
import { getCurrentStaffMember } from "@/lib/team/service";
import { sendEmail } from "@/lib/email/send";
import {
  buildContractInviteSubject,
  buildContractInviteText,
  buildContractInviteHtml,
} from "@/lib/email/contract-invite";
import { CONTRACT_SIGNATURE_CONSENT_TEXT, hashContractContent } from "@/lib/contracts/signers";
import { captureContractBrandingSnapshot } from "@/lib/contracts/branding";
import type { ClientSignerSeed } from "@/lib/contracts/repository";

export { hashContractContent } from "@/lib/contracts/signers";

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

async function currentActor(
  venueId: string,
): Promise<{ userId: string | null; label: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const staff = await getCurrentStaffMember(venueId);
  return { userId: user?.id ?? null, label: staff?.name ?? user?.email ?? null };
}

/** Resolve required client signers — never auto-assumes couple = 2. */
async function resolveClientSignerSeeds(
  clientId: string,
  selectedContactIds?: string[],
): Promise<{ ok: true; seeds: ClientSignerSeed[] } | { ok: false; message: string }> {
  const client = await getClient(clientId);
  if (!client) return { ok: false, message: "Client not found." };
  const contacts = await getClientContacts(clientId);

  if (selectedContactIds && selectedContactIds.length > 0) {
    const seeds: ClientSignerSeed[] = [];
    for (const contactId of selectedContactIds) {
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) return { ok: false, message: "One of the selected signers was not found." };
      if (!contact.email?.trim()) {
        return {
          ok: false,
          message: `${contact.firstName} has no email on file — add an email before making them a required signer.`,
        };
      }
      seeds.push({
        clientContactId: contact.id,
        signerRefId: contact.id,
        signerName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        signerEmail: contact.email.trim(),
        signerRole: contact.roleLabel || contact.relationship || null,
      });
    }
    return { ok: true, seeds };
  }

  // Default: one required signer from primary contact, else the client record
  const primary = contacts.find((c) => c.isPrimary && c.email?.trim())
    ?? contacts.find((c) => c.email?.trim());
  if (primary?.email?.trim()) {
    return {
      ok: true,
      seeds: [{
        clientContactId: primary.id,
        signerRefId: primary.id,
        signerName: [primary.firstName, primary.lastName].filter(Boolean).join(" "),
        signerEmail: primary.email.trim(),
        signerRole: primary.roleLabel || primary.relationship || "primary",
      }],
    };
  }
  if (!client.email?.trim()) {
    return { ok: false, message: "This client has no email on file — add one before creating a contract." };
  }
  return {
    ok: true,
    seeds: [{
      clientContactId: null,
      signerRefId: client.id,
      signerName: [client.firstName, client.lastName].filter(Boolean).join(" "),
      signerEmail: client.email.trim(),
      signerRole: "primary",
    }],
  };
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
export async function getContractByToken(token: string): Promise<(Contract & {
  tokenSigner?: {
    id: string | null;
    signerType: string;
    signerName: string | null;
    signerEmail: string | null;
    signedAt: string | null;
    legacy: boolean;
  } | null;
}) | null> {
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
    if (input.templateId) {
      const tmpl = await repo.getTemplate(supabase, venueId, input.templateId);
      if (!tmpl) return { ok: false, message: "Template not found." } as CreateContractResult;
      if (tmpl.isArchived) {
        return { ok: false, message: "This template is archived. Restore it in the Library before creating a contract." } as CreateContractResult;
      }
    }
    const signerSeeds = await resolveClientSignerSeeds(input.clientId, input.clientSignerContactIds);
    if (!signerSeeds.ok) return { ok: false, message: signerSeeds.message } as CreateContractResult;

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
    await repo.insertContractSigners(supabase, venueId, contractId, signerSeeds.seeds);
    const actor = await currentActor(venueId);
    await repo.insertContractActivity(
      supabase, venueId, contractId, "contract_created", "Contract created",
      undefined, actor.userId, actor.label,
    );
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
    if (!source.clientId) {
      return { ok: false, message: "This contract has no client — cannot create an amendment." } as CreateContractResult;
    }
    const seeds = await resolveClientSignerSeeds(source.clientId);
    if (!seeds.ok) return { ok: false, message: seeds.message } as CreateContractResult;

    const newContractId = await repo.insertContract(supabase, venueId, {
      templateId: source.templateId ?? "",
      clientId: source.clientId ?? "",
      eventId: source.eventId ?? "",
      title: `${source.title} — Amendment`,
      content: source.content,
      amendsContractId: sourceContractId,
    });
    // Fresh venue-then-client cycle — never inherit prior signers
    await repo.insertContractSigners(supabase, venueId, newContractId, seeds.seeds);
    const actor = await currentActor(venueId);
    await repo.insertContractActivity(
      supabase, venueId, newContractId, "contract_created",
      `Amendment of "${source.title}" created`,
      undefined, actor.userId, actor.label,
    );

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

/** Shared by sendContract (first send) and resendContract — per-signer invite emails. */
async function sendContractInviteEmails(
  contract: ContractWithDetails,
  customMessage?: string,
): Promise<void> {
  const venue = await getCurrentVenue();
  if (!venue) return;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
  const brand = { name: venue.name ?? "Your venue", logoUrl: venue.logoUrl, primaryColor: venue.primaryColor };

  const clientSigners = (contract.signers ?? []).filter((s) => s.signerType === "client" && s.isRequired);
  if (clientSigners.length > 0) {
    for (const signer of clientSigners) {
      if (!signer.signerEmail) continue;
      const signUrl = `${baseUrl}/sign/${signer.signToken}`;
      const firstName = (signer.signerName ?? "there").split(/\s+/)[0] || "there";
      const ctx = {
        brand,
        recipientFirstName: firstName,
        contractTitle: contract.title,
        signUrl,
        customMessage,
      };
      await sendEmail({
        to: signer.signerEmail,
        subject: buildContractInviteSubject(ctx),
        text: buildContractInviteText(ctx),
        html: buildContractInviteHtml(ctx),
      });
    }
    return;
  }

  // Legacy fallback — shared contracts.sign_token to client.email
  if (!contract.clientId) return;
  const client = await getClient(contract.clientId);
  if (!client?.email) return;
  const signUrl = `${baseUrl}/sign/${contract.signToken}`;
  const ctx = { brand, recipientFirstName: client.firstName, contractTitle: contract.title, signUrl, customMessage };
  await sendEmail({
    to: client.email,
    subject: buildContractInviteSubject(ctx),
    text: buildContractInviteText(ctx),
    html: buildContractInviteHtml(ctx),
  });
}

export async function venueSignContract(
  id: string,
  signerName: string,
  consent: boolean,
): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can sign for the venue." } as ContractActionResult;
    }
    if (!signerName.trim()) return { ok: false, message: "Please enter your full name." } as ContractActionResult;
    if (!consent) {
      return { ok: false, message: "Please confirm you agree this constitutes your legal signature." } as ContractActionResult;
    }

    const contract = await repo.getContract(supabase, venueId, id);
    if (!contract) return { ok: false, message: "Contract not found." } as ContractActionResult;

    const safety = assertCustomerSafeContractContent(contract.content);
    if (!safety.ok) return { ok: false, message: safety.message } as ContractActionResult;

    const { headers } = await import("next/headers");
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
    const userAgent = headerList.get("user-agent");
    const actor = await currentActor(venueId);
    const venue = await getCurrentVenue();
    const staff = await getCurrentStaffMember(venueId);

    const outcome = await repo.venueSignContract(supabase, venueId, id, {
      signerName: signerName.trim(),
      signerEmail: venue?.email ?? staff?.email ?? null,
      signerRole: role,
      signerRefId: actor.userId ?? "",
      consent,
      consentText: CONTRACT_SIGNATURE_CONSENT_TEXT,
      contentHash: hashContractContent(contract.content),
      ip,
      userAgent,
      actorId: actor.userId,
      actorLabel: actor.label,
    });
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function withdrawVenueSignature(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can withdraw the venue signature." } as ContractActionResult;
    }
    const actor = await currentActor(venueId);
    const outcome = await repo.clearVenueSignature(supabase, venueId, id, actor.userId, actor.label);
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function sendContract(id: string, customMessage?: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const contract = await repo.getContract(supabase, venueId, id);
    if (!contract) return { ok: false, message: "Contract not found." } as ContractActionResult;

    const venueSigner = (contract.signers ?? []).find((s) => s.signerType === "venue");
    if (!venueSigner?.signedAt) {
      return { ok: false, message: "The venue must sign this contract before it can be released to the client." } as ContractActionResult;
    }

    // Content is immutable after venue sign — do not force-resolve tokens here.
    const safety = assertCustomerSafeContractContent(contract.content);
    if (!safety.ok) {
      return { ok: false, message: safety.message } as ContractActionResult;
    }

    const venue = await getCurrentVenue();
    const brandingSnapshot = venue ? captureContractBrandingSnapshot(venue) : undefined;
    const outcome = await repo.updateContractStatus(supabase, venueId, id, "sent", {
      sentAt: true,
      brandingSnapshot,
    });
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    const actor = await currentActor(venueId);
    await repo.insertContractActivity(
      supabase, venueId, id, "sent", "Contract released for client signature",
      undefined, actor.userId, actor.label,
    );

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

    const refreshed = await repo.getContract(supabase, venueId, id);
    await sendContractInviteEmails(refreshed ?? contract, customMessage);

    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

/**
 * Work Package D5E — "Resend" for a contract already `sent` and still
 * awaiting signature.
 */
export async function resendContract(id: string, customMessage?: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const contract = await repo.getContract(supabase, venueId, id);
    if (!contract) return { ok: false, message: "Contract not found." } as ContractActionResult;
    if (contract.status !== "sent") {
      return { ok: false, message: "Only a contract that's already been sent and is still awaiting signature can be resent." } as ContractActionResult;
    }
    await sendContractInviteEmails(contract, customMessage);
    const actor = await currentActor(venueId);
    await repo.insertContractActivity(
      supabase, venueId, id, "resent", "Contract resent for signing",
      undefined, actor.userId, actor.label,
    );
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function cancelContract(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const outcome = await repo.updateContractStatus(supabase, venueId, id, "cancelled");
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    const actor = await currentActor(venueId);
    await repo.insertContractActivity(
      supabase, venueId, id, "cancelled", "Contract cancelled",
      undefined, actor.userId, actor.label,
    );
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

/** Work Package D4 — closes the negotiation-loop gap; see repository.ts's own comment on reopenForEditing. */
export async function reopenContractForEditing(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const actor = await currentActor(venueId);
    const outcome = await repo.reopenForEditing(supabase, venueId, id, actor.userId, actor.label);
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

/** Public action — signs via SECURITY DEFINER RPC (per-signer or legacy). */
export async function signContractByToken(
  token: string,
  signerName: string,
  consent: boolean,
): Promise<{ ok: boolean; message?: string; clientId?: string | null; celebrated?: boolean; fullyExecuted?: boolean }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!signerName.trim()) return { ok: false, message: "Please enter your full name." };
  if (!consent) return { ok: false, message: "Please confirm you agree this constitutes your legal signature." };
  const supabase = await createClient();

  const { headers } = await import("next/headers");
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const userAgent = headerList.get("user-agent");

  const contractRow = await repo.getContractByToken(supabase, token);
  if (!contractRow) return { ok: false, message: "This contract is not available for signing." };

  // Expiration (also enforced in RPC — defense in depth)
  if (contractRow.expiresAt && contractRow.expiresAt < new Date().toISOString().slice(0, 10)) {
    return { ok: false, message: "This signing link has expired." };
  }

  if (contractRow.status !== "sent") {
    return { ok: false, message: "This contract is not available for signing." };
  }

  const contentHash = hashContractContent(contractRow.content);
  const isLegacy = contractRow.tokenSigner?.legacy === true || !contractRow.tokenSigner?.id;

  if (!isLegacy) {
    if (contractRow.tokenSigner?.signerType === "venue") {
      return { ok: false, message: "This contract is not available for signing." };
    }
    if (contractRow.tokenSigner?.signedAt) {
      return { ok: false, message: "This contract is not available for signing." };
    }

    const { data, error } = await supabase.rpc("sign_contract_signer", {
      p_token: token,
      p_signer: signerName.trim(),
      p_ip: ip,
      p_user_agent: userAgent,
      p_consent: consent,
      p_consent_text: CONTRACT_SIGNATURE_CONSENT_TEXT,
      p_content_hash: contentHash,
    });
    if (error) return { ok: false, message: error.message };
    const result = data as { ok: boolean; celebrated?: boolean; fully_executed?: boolean; reason?: string } | null;
    if (!result?.ok) {
      if (result?.reason === "content_hash_mismatch") {
        return { ok: false, message: "This agreement could not be completed because its content no longer matches what was signed. Please contact the venue." };
      }
      return { ok: false, message: "This contract is not available for signing." };
    }

    if (result.fully_executed && contractRow.venueId) {
      void recordEngagementEvent({
        venueId: contractRow.venueId,
        eventType: "contract.signed",
        actorType: "couple",
        entityType: "contract",
        entityId: contractRow.id,
      });
      if (contractRow.eventId) {
        const { triggerAutoComplete } = await import("@/lib/playbooks/service");
        const admin = createAdminClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await triggerAutoComplete(admin as any, contractRow.venueId, contractRow.eventId, "contract_signed");
      }
    }

    return {
      ok: true,
      clientId: contractRow.clientId ?? null,
      celebrated: result.celebrated === true,
      fullyExecuted: result.fully_executed === true,
    };
  }

  // Legacy shared-token path for in-flight contracts
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

  if (contractRow.venueId) {
    void recordEngagementEvent({
      venueId: contractRow.venueId,
      eventType: "contract.signed",
      actorType: "couple",
      entityType: "contract",
      entityId: contractRow.id,
    });
    if (contractRow.eventId) {
      const { triggerAutoComplete } = await import("@/lib/playbooks/service");
      const admin = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await triggerAutoComplete(admin as any, contractRow.venueId, contractRow.eventId, "contract_signed");
    }
  }

  return { ok: true, clientId: contractRow.clientId ?? null, celebrated: result.celebrated === true, fullyExecuted: true };
}

export { mergeContent };

/**
 * Contracts application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured, publicAppOrigin } from "@/lib/env";
import * as repo from "@/lib/contracts/repository";
import * as documentIntegration from "@/lib/contracts/document-integration";
import { buildMergeData, mergeContent, assertCustomerSafeContractContent } from "@/lib/contracts/merge";
import {
  formatBalanceRemaining,
  formatCeremonyOrReceptionSummary,
  formatContractTotalAmount,
  formatVenueAccessHours,
} from "@/lib/contracts/merge-extras";
import {
  EMPTY_EVENT_SPACES_LABEL,
  replaceEmptyEventSpacesLabel,
  resolveEventSpacesLabel,
} from "@/lib/contracts/event-spaces-merge";
import { getSpaces } from "@/lib/availability/service";
import { getEventIdForClient } from "@/lib/events/service";
import { getEventOrder } from "@/lib/event-orders/service";
import { getQuestionnaire } from "@/lib/events/questionnaire";
import { getPaymentSchedules, getPaymentSchedule } from "@/lib/payments/service";
import { computePortalScheduleTotals } from "@/lib/portal/payment-totals";
import { formatContractDate } from "@/lib/contracts/constants";
import { formatCurrency } from "@/lib/invoices/constants";
import { labelForUseKey } from "@/lib/venue-spaces/uses";
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
import { emailBrandFromVenue } from "@/lib/email/venue-brand";
import {
  buildContractInviteHtml,
  buildContractInviteSubject,
  buildContractInviteText,
} from "@/lib/email/contract-invite";
import { recordExternalClientOutbound } from "@/lib/conversations/record-external-outbound";
import { cancelRemindersForContract, createRemindersForContract, getReminderCadence } from "@/lib/notifications/obligations";
import { CONTRACT_SIGNATURE_CONSENT_TEXT, hashContractContent } from "@/lib/contracts/signers";
import { applyRequiredSignerSignatureBlocks } from "@/lib/contracts/signature-blocks";
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
  const { resolveSignerSeedsFromSelection } = await import("@/lib/contracts/signer-candidates");
  return resolveSignerSeedsFromSelection(client, contacts, selectedContactIds);
}

/**
 * Re-seed from persisted contract_signers without dropping relationship
 * primary/partner rows that have null client_contact_id.
 */
async function resolveClientSignerSeedsFromPersistedSigners(
  clientId: string,
  signers: Array<{
    signerType: string;
    isRequired: boolean;
    clientContactId: string | null;
    signerEmail: string | null;
    signerRole: string | null;
  }>,
): Promise<{ ok: true; seeds: ClientSignerSeed[] } | { ok: false; message: string }> {
  const client = await getClient(clientId);
  if (!client) return { ok: false, message: "Client not found." };
  const contacts = await getClientContacts(clientId);
  const {
    buildSignerCandidates,
    resolveSignerSeedsFromSelection,
    selectedIdsFromExistingSigners,
  } = await import("@/lib/contracts/signer-candidates");
  const candidates = buildSignerCandidates(client, contacts);
  const selectedIds = selectedIdsFromExistingSigners(candidates, signers);
  return resolveSignerSeedsFromSelection(client, contacts, selectedIds);
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

/** Version family for a contract (derived from amends_contract_id). */
export async function getContractVersionFamily(contractId: string): Promise<
  import("@/lib/contracts/version-lineage").ContractVersionEntry[]
> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const nodes = await repo.listContractLineageNodes(supabase, venue.id, [contractId]);
  const { isContractFinalized } = await import("@/lib/contracts/document-integration");
  const ids = nodes.map((n) => n.id);
  const { data: signerRows } = ids.length
    ? await supabase
        .from("contract_signers")
        .select("contract_id, signer_type, signed_at, is_required")
        .eq("venue_id", venue.id)
        .in("contract_id", ids)
    : { data: [] as { contract_id: string; signer_type: string; signed_at: string | null; is_required: boolean }[] };

  type Progress = {
    venueSigned: boolean;
    requiredClientTotal: number;
    requiredClientSigned: number;
    anyClientSigned: boolean;
  };
  const progressByContract = new Map<string, Progress>();
  for (const row of (signerRows ?? []) as {
    contract_id: string; signer_type: string; signed_at: string | null; is_required: boolean;
  }[]) {
    const cur = progressByContract.get(row.contract_id) ?? {
      venueSigned: false,
      requiredClientTotal: 0,
      requiredClientSigned: 0,
      anyClientSigned: false,
    };
    if (row.signer_type === "venue") {
      cur.venueSigned = Boolean(row.signed_at);
    } else if (row.signer_type === "client") {
      if (row.is_required) {
        cur.requiredClientTotal += 1;
        if (row.signed_at) cur.requiredClientSigned += 1;
      }
      if (row.signed_at) cur.anyClientSigned = true;
    }
    progressByContract.set(row.contract_id, cur);
  }

  const withFinal = await Promise.all(
    nodes.map(async (n) => {
      const progress = progressByContract.get(n.id);
      return {
        ...n,
        venueSigned: progress?.venueSigned ?? false,
        anyClientSigned: progress?.anyClientSigned ?? false,
        requiredClientTotal: progress?.requiredClientTotal ?? 0,
        requiredClientSigned: progress?.requiredClientSigned ?? 0,
        finalized: n.status === "signed" ? await isContractFinalized(supabase, n.id) : false,
      };
    }),
  );
  const { buildContractVersionFamily } = await import("@/lib/contracts/version-lineage");
  return buildContractVersionFamily(contractId, withFinal);
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
  const contract = await repo.getContractByToken(await createClient(), token);
  // Externally executed agreements are not opened for HTC e-sign.
  if (contract?.executionOrigin === "external") return null;
  return contract;
}

/**
 * Generate a draft contract from a template + client/event.
 * Stores authored content (Smart Fields intact). Tokens resolve at Send.
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

    // Contextual Event auto-link: when client is known and no event was
    // provided, attach their associated dated Event when one exists.
    let eventId = input.eventId?.trim() || "";
    if (!eventId && input.clientId) {
      const { data: datedEvent } = await supabase
        .from("events")
        .select("id")
        .eq("venue_id", venueId)
        .eq("client_id", input.clientId)
        .not("event_date", "is", null)
        .order("event_date", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (datedEvent?.id) eventId = datedEvent.id;
    }

    const resolvedInput: NewContractInput = { ...input, eventId };

    const signerSeeds = await resolveClientSignerSeeds(resolvedInput.clientId, resolvedInput.clientSignerContactIds);
    if (!signerSeeds.ok) return { ok: false, message: signerSeeds.message } as CreateContractResult;

    const { resolveActiveCommercialSelection } = await import("@/lib/commercial-selections/service");
    const activeSelection = await resolveActiveCommercialSelection({
      selectionId: resolvedInput.selectionId,
      eventId: resolvedInput.eventId,
      clientId: resolvedInput.clientId,
    });
    const mergeSelectionId = activeSelection?.id ?? resolvedInput.selectionId;

    // Token-preserving draft: store authored content (Smart Fields intact).
    // Tokens resolve only at Send. Preview is display-only and never writes back.
    const contractId = await repo.insertContract(supabase, venueId, {
      ...resolvedInput,
      content: resolvedInput.content,
    });
    await repo.insertContractSigners(supabase, venueId, contractId, signerSeeds.seeds);
    const actor = await currentActor(venueId);
    await repo.insertContractActivity(
      supabase, venueId, contractId, "contract_created", "Contract created",
      undefined, actor.userId, actor.label,
    );
    if (mergeSelectionId) {
      const { linkSelectionContract } = await import("@/lib/commercial-selections/service");
      await linkSelectionContract(mergeSelectionId, contractId);
    }
    return { ok: true, contractId } as CreateContractResult;
  });
  return result as CreateContractResult;
}

/**
 * Resolve authored (tokenized) draft content into customer-facing text.
 * Used by Preview (display-only) and Send (the only persist path).
 * Never writes the draft.
 *
 * Signer names: prefer `requiredClientSignerNames` when already known from
 * persisted `contract_signers` (Send). Otherwise resolve from
 * `clientSignerContactIds` (Preview / create). Never fall back to primary-only
 * when the contract already has multiple required client signers on file.
 */
export async function materializeAuthoredContractContent(opts: {
  authoredContent: string;
  clientId: string;
  eventId: string;
  contractTitle: string;
  clientSignerContactIds?: string[];
  /** Authoritative names from persisted required client signers (Send freeze). */
  requiredClientSignerNames?: string[];
  selectionId?: string;
}): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
  try {
    let requiredClientSignerNames =
      opts.requiredClientSignerNames
        ?.map((n) => n.trim())
        .filter(Boolean) ?? [];

    if (requiredClientSignerNames.length === 0) {
      const signerSeeds = await resolveClientSignerSeeds(opts.clientId, opts.clientSignerContactIds);
      if (!signerSeeds.ok) return { ok: false, message: signerSeeds.message };
      requiredClientSignerNames = signerSeeds.seeds.map((s) => s.signerName);
    }

    const { resolveActiveCommercialSelection } = await import("@/lib/commercial-selections/service");
    const activeSelection = await resolveActiveCommercialSelection({
      selectionId: opts.selectionId,
      eventId: opts.eventId,
      clientId: opts.clientId,
    });
    const mergeData = await buildContractMergeData({
      clientId: opts.clientId,
      eventId: opts.eventId,
      contractTitle: opts.contractTitle,
      selectionId: activeSelection?.id ?? opts.selectionId,
      requiredClientSignerNames,
    });
    const content = applyRequiredSignerSignatureBlocks(
      replaceEmptyEventSpacesLabel(
        mergeContent(opts.authoredContent, mergeData),
        mergeData.event_spaces ?? EMPTY_EVENT_SPACES_LABEL,
      ),
      requiredClientSignerNames,
    );
    return { ok: true, content };
  } catch {
    return { ok: false, message: "Could not resolve contract details." };
  }
}

/** Live preview of merged contract body, including per-signer signature blocks. */
export async function previewContractContent(opts: {
  templateContent: string;
  clientId: string;
  eventId: string;
  contractTitle: string;
  clientSignerContactIds?: string[];
  selectionId?: string;
}): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
  const result = await materializeAuthoredContractContent({
    authoredContent: opts.templateContent,
    clientId: opts.clientId,
    eventId: opts.eventId,
    contractTitle: opts.contractTitle,
    clientSignerContactIds: opts.clientSignerContactIds,
    selectionId: opts.selectionId,
  });
  if (!result.ok) {
    return { ok: false, message: result.message === "Could not resolve contract details." ? "Could not preview contract." : result.message };
  }
  return result;
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
    const seeds = await resolveClientSignerSeedsFromPersistedSigners(
      source.clientId,
      source.signers ?? [],
    );
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
  selectionId?: string;
  /** Required client signer display names — drives {{client_name}} party wording. */
  requiredClientSignerNames?: string[];
}): Promise<Record<string, string>> {
  // Prefer an explicit eventId; otherwise use the client's canonical dated Event
  // so booked Event.space_id is visible even when the create URL omitted eventId.
  let resolvedEventId = opts.eventId?.trim() || "";
  if (!resolvedEventId && opts.clientId) {
    try {
      resolvedEventId = (await getEventIdForClient(opts.clientId)) ?? "";
    } catch { /* optional */ }
  }

  const [venue, client, event] = await Promise.all([
    getCurrentVenue(),
    opts.clientId ? getClient(opts.clientId) : Promise.resolve(null),
    resolvedEventId ? getEvent(resolvedEventId) : Promise.resolve(null),
  ]);

  const addressParts = [
    venue?.addressLine1,
    venue?.addressLine2,
    [venue?.city, venue?.stateRegion].filter(Boolean).join(", "),
    venue?.postalCode,
  ].filter((p) => p && String(p).trim());
  const venueAddress = addressParts.length > 0 ? addressParts.join("\n") : null;

  let eventSpaces = EMPTY_EVENT_SPACES_LABEL;
  // Package / payment contractual fields — filled only from existing SoT at contract time.
  let packageSection = "";
  let includedItemsSummary = "";
  let additionalItemsSummary = "";
  let paymentScheduleSummary = "";
  let contractTotal: string | null = null;
  let balanceRemaining: string | null = null;
  let coordinatorName: string | null = null;
  let packageFromSelection = false;
  let ceremonySpaceLabel: string | null = null;
  let receptionSpaceLabel: string | null = null;

  // Prefer frozen Selected Package (Booking Journey) over Event Order for package merge fields.
  try {
    const { resolveActiveCommercialSelection } =
      await import("@/lib/commercial-selections/service");
    const { formatPackageSection } = await import("@/lib/commercial-selections/constants");
    const selection = await resolveActiveCommercialSelection({
      selectionId: opts.selectionId,
      eventId: opts.eventId,
      clientId: opts.clientId,
    });
    if (selection) {
      packageFromSelection = true;
      packageSection = formatPackageSection(selection.name, selection.totalAmount, selection.includedItems, {
        depositAmount: selection.depositAmount,
      });
      if (selection.includedItems.length > 0) {
        includedItemsSummary = selection.includedItems
          .map((l) => `• ${l.description}${l.quantity ? ` × ${l.quantity}` : ""}${l.unit ? ` ${l.unit}` : ""}`)
          .join("\n");
      }
      contractTotal = formatContractTotalAmount(selection.totalAmount);
    }
  } catch { /* selection optional */ }

  if (venue) {
    try {
      const details = await (await import("@/lib/venue/repository")).getVenueFullDetails(await createClient());
      if (details?.ownerName?.trim()) coordinatorName = details.ownerName.trim();
    } catch { /* optional */ }
  }

  // Event Spaces: assignments (use → physical) win; else Event.space_id; else lead planned.
  // Same venue_spaces catalog — no second source of truth.
  try {
    let plannedEventSpaceId: string | null = null;
    const supabase = await createClient();
    if (client?.leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("planned_event_space_id")
        .eq("id", client.leadId)
        .maybeSingle<{ planned_event_space_id: string | null }>();
      plannedEventSpaceId = lead?.planned_event_space_id ?? null;
    }
    const spaces = await getSpaces();
    let assignments: Array<{ useKey: string; useLabel: string; spaceId: string; spaceName: string | null }> = [];
    if (event?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (supabase.from("event_space_assignments") as any)
        .select("use_key, use_label, space_id, venue_spaces(name)")
        .eq("event_id", event.id)
        .order("sort_order");
      assignments = ((rows ?? []) as Array<{
        use_key: string;
        use_label: string;
        space_id: string;
        venue_spaces?: { name: string } | null;
      }>).map((r) => ({
        useKey: r.use_key,
        useLabel: r.use_label,
        spaceId: r.space_id,
        spaceName: r.venue_spaces?.name ?? null,
      }));
    }
    eventSpaces = resolveEventSpacesLabel({
      spaces,
      eventSpaceId: event?.spaceId ?? null,
      plannedEventSpaceId,
      assignments,
    });
    // Keep EMPTY_EVENT_SPACES_LABEL — buildMergeData always materializes it.
    // Never clear to "" (that left raw {{event_spaces}} in customer-facing output).

    const ceremonyAsg = assignments.find((a) => a.useKey === "ceremony");
    const receptionAsg = assignments.find((a) => a.useKey === "reception");
    if (ceremonyAsg?.spaceName?.trim()) {
      ceremonySpaceLabel = `${labelForUseKey(ceremonyAsg.useKey, ceremonyAsg.useLabel)}: ${ceremonyAsg.spaceName.trim()}`;
    }
    if (receptionAsg?.spaceName?.trim()) {
      receptionSpaceLabel = `${labelForUseKey(receptionAsg.useKey, receptionAsg.useLabel)}: ${receptionAsg.spaceName.trim()}`;
    }
  } catch { /* optional */ }

  if (event) {
    try {
      const order = await getEventOrder(event.id);
      if (order?.lines?.length) {
        // Package-defined lines only — inventory/operational assignments are not contract-time SoT.
        const packageLines = order.lines.filter((l) => l.provenance === "package");
        const additional = order.lines.filter((l) => l.provenance === "custom");
        if (!packageFromSelection && packageLines.length > 0) {
          const names = [...new Set(packageLines.map((l) => l.description))];
          packageSection = `Selected package / services:\n${names.map((n) => `• ${n}`).join("\n")}`;
          includedItemsSummary = packageLines
            .map((l) => `• ${l.description}${l.quantity ? ` × ${l.quantity}` : ""}`)
            .join("\n");
        }
        if (additional.length > 0) {
          additionalItemsSummary = additional
            .map((l) => `• ${l.description}${l.quantity ? ` × ${l.quantity}` : ""}`)
            .join("\n");
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
          const fmt = (n: number) => formatCurrency(n, currency);
          paymentScheduleSummary = detail.lineItems
            .map((li) => {
              const due = li.dueDate ? formatContractDate(li.dueDate) : "Date TBD";
              return `• ${li.label}: ${fmt(li.amount)} — due ${due}${li.status === "paid" ? " (paid)" : ""}`;
            })
            .join("\n");
          const totals = computePortalScheduleTotals(detail.lineItems);
          balanceRemaining = formatBalanceRemaining(totals.remaining);
          if (!packageFromSelection) {
            contractTotal = fmt(detail.totalAmount);
          }
        }
      }
    } catch { /* optional */ }
  }

  const venueAccessHours = formatVenueAccessHours({
    setupTime: event?.setupTime ?? null,
    startTime: event?.startTime ?? client?.ceremonyTime ?? null,
    endTime: event?.endTime ?? client?.receptionTime ?? null,
    teardownTime: event?.teardownTime ?? null,
  });

  let ceremonySummary: string | null = null;
  let receptionSummary: string | null = null;
  if (event?.id) {
    try {
      const questionnaire = await getQuestionnaire(event.id, "final_details");
      ceremonySummary = formatCeremonyOrReceptionSummary({
        label: "Ceremony",
        location: questionnaire?.ceremonyLocation,
        startTime: questionnaire?.ceremonyStartTime ?? client?.ceremonyTime ?? null,
        spaceAssignmentLabel: ceremonySpaceLabel,
      });
      receptionSummary = formatCeremonyOrReceptionSummary({
        label: "Reception",
        location: questionnaire?.receptionLocation,
        startTime: questionnaire?.receptionStartTime ?? client?.receptionTime ?? null,
        spaceAssignmentLabel: receptionSpaceLabel,
      });
    } catch { /* optional */ }
  }
  if (!ceremonySummary) {
    ceremonySummary = formatCeremonyOrReceptionSummary({
      label: "Ceremony",
      location: null,
      startTime: client?.ceremonyTime ?? null,
      spaceAssignmentLabel: ceremonySpaceLabel,
    });
  }
  if (!receptionSummary) {
    receptionSummary = formatCeremonyOrReceptionSummary({
      label: "Reception",
      location: null,
      startTime: client?.receptionTime ?? null,
      spaceAssignmentLabel: receptionSpaceLabel,
    });
  }

  return buildMergeData({
    venueName: venue?.name ?? "",
    venueAddress,
    venuePhone: venue?.phone?.trim() || null,
    venueEmail: venue?.email?.trim() || null,
    clientFirstName: client?.firstName ?? "",
    clientLastName: client?.lastName ?? "",
    clientEmail: client?.email?.trim() || null,
    clientPhone: client?.phone?.trim() || null,
    requiredClientSignerNames: opts.requiredClientSignerNames ?? null,
    eventName: event?.name || null,
    eventDate: event?.eventDate ?? client?.eventDate ?? null,
    eventType: event?.eventType ?? client?.eventType ?? null,
    guestCount: event?.guestCount ?? client?.guestCount ?? null,
    eventSpaces,
    coordinatorName,
    packageSection: packageSection || null,
    includedItemsSummary: includedItemsSummary || null,
    additionalItemsSummary: additionalItemsSummary || null,
    paymentScheduleSummary: paymentScheduleSummary || null,
    contractTotal,
    contractTitle: opts.contractTitle ?? "",
    venueAccessHours,
    ceremonySummary,
    receptionSummary,
    balanceRemaining,
  });
}

export async function updateContractContent_(
  id: string,
  title: string,
  content: string,
  expectedUpdatedAt: string,
  clientSignerContactIds?: string[],
): Promise<ContractActionResult> {
  if (!title.trim() || !content.trim()) return { ok: false, message: "Title and content are required." };
  const result = await withVenue(async (supabase, venueId) => {
    const outcome = await repo.updateContractContent(supabase, venueId, id, title, content, expectedUpdatedAt);
    if (!outcome.ok) return { ok: false, message: outcome.message, reason: outcome.reason } as ContractActionResult;

    if (clientSignerContactIds !== undefined) {
      const contract = await repo.getContract(supabase, venueId, id);
      if (!contract?.clientId) {
        return { ok: false, message: "This draft has no client — cannot update signers." } as ContractActionResult;
      }
      const seeds = await resolveClientSignerSeeds(contract.clientId, clientSignerContactIds);
      if (!seeds.ok) return { ok: false, message: seeds.message } as ContractActionResult;
      const replaced = await repo.replaceDraftClientSigners(supabase, venueId, id, seeds.seeds);
      if (!replaced.ok) return { ok: false, message: replaced.message } as ContractActionResult;
    }

    return { ok: true, updatedAt: outcome.updatedAt } as ContractActionResult;
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
  const baseUrl = publicAppOrigin();
  const brand = emailBrandFromVenue(venue);
  const supabase = await createClient();

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
      const text = buildContractInviteText(ctx);
      const result = await sendEmail({
        to: signer.signerEmail,
        subject: buildContractInviteSubject(ctx),
        text,
        html: buildContractInviteHtml(ctx),
        replyTo: venue.email ?? undefined,
      });
      if (result.ok && contract.clientId) {
        await recordExternalClientOutbound(supabase, {
          venueId: venue.id,
          clientId: contract.clientId,
          channel: "email",
          body: text,
          providerId: result.method === "resend" ? result.providerId ?? null : null,
          status: "accepted",
          sourceType: "contract_invite",
          sourceId: contract.id,
        });
      }
    }
    return;
  }

  // Legacy fallback — shared contracts.sign_token to client.email
  if (!contract.clientId) return;
  const client = await getClient(contract.clientId);
  if (!client?.email) return;
  const signUrl = `${baseUrl}/sign/${contract.signToken}`;
  const ctx = {
    brand,
    recipientFirstName: client.firstName,
    contractTitle: contract.title,
    signUrl,
    customMessage,
  };
  const text = buildContractInviteText(ctx);
  const result = await sendEmail({
    to: client.email,
    subject: buildContractInviteSubject(ctx),
    text,
    html: buildContractInviteHtml(ctx),
    replyTo: venue.email ?? undefined,
  });
  if (result.ok) {
    await recordExternalClientOutbound(supabase, {
      venueId: venue.id,
      clientId: contract.clientId,
      channel: "email",
      body: text,
      providerId: result.method === "resend" ? result.providerId ?? null : null,
      status: "accepted",
      sourceType: "contract_invite",
      sourceId: contract.id,
    });
  }
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

    // Fully executed side-effects fire when the venue countersigns (client-first).
    void recordEngagementEvent({
      venueId,
      eventType: "contract.signed",
      actorType: "venue_user",
      entityType: "contract",
      entityId: id,
    });
    if (contract.eventId) {
      const { triggerAutoComplete } = await import("@/lib/playbooks/service");
      await triggerAutoComplete(supabase, venueId, contract.eventId, "contract_signed");
    }
    if (contract.clientId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("luv_celebrations") as any).insert({
          venue_id: venueId,
          client_id: contract.clientId,
          event_id: contract.eventId,
          celebration_type: "contract_signed",
          entity_id: id,
        });
      } catch {
        // Unique conflict is fine — celebration already recorded.
      }
    }

    return {
      ok: true,
      newlyBooked: false,
      clientId: contract.clientId,
      eventId: contract.eventId,
    } as ContractActionResult;
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
    if (contract.executionOrigin === "external") {
      return {
        ok: false,
        message: "This agreement was executed outside Hello to Cheers. It cannot be sent for HTC e-signature — attach the original signed file as a document instead.",
      } as ContractActionResult;
    }

    // Client-first: venue signature is not required to issue the contract.

    // Freeze using the same required client signers that drive invite emails.
    // Do NOT re-derive from clientContactId alone — relationship primary/partner
    // seeds store clientContactId=null, which previously dropped Brian and froze
    // primary-only content while still creating two signing links.
    const { requiredClientSignerNamesFromSigners } = await import("@/lib/contracts/signer-candidates");
    const requiredClientSignerNames = requiredClientSignerNamesFromSigners(contract.signers ?? []);
    const materialized = await materializeAuthoredContractContent({
      authoredContent: contract.content,
      clientId: contract.clientId ?? "",
      eventId: contract.eventId ?? "",
      contractTitle: contract.title,
      requiredClientSignerNames:
        requiredClientSignerNames.length > 0 ? requiredClientSignerNames : undefined,
    });
    if (!materialized.ok) {
      return { ok: false, message: materialized.message } as ContractActionResult;
    }
    const safety = assertCustomerSafeContractContent(materialized.content);
    if (!safety.ok) {
      return { ok: false, message: safety.message } as ContractActionResult;
    }
    await repo.forceResolveContractContent(supabase, venueId, id, materialized.content);
    const customerFacing = { ...contract, content: materialized.content };

    const venue = await getCurrentVenue();
    const brandingSnapshot = venue ? captureContractBrandingSnapshot(venue) : undefined;
    const outcome = await repo.updateContractStatus(supabase, venueId, id, "sent", {
      sentAt: true,
      brandingSnapshot,
    });
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    const actor = await currentActor(venueId);
    await repo.insertContractActivity(
      supabase, venueId, id, "sent", "Contract sent to client for review",
      undefined, actor.userId, actor.label,
    );

    // Work Package D4 — Document Domain integration.
    {
      const existingDocumentId = await documentIntegration.getContractDocumentId(supabase, id);
      if (!existingDocumentId) {
        const { documentId: newDocumentId } = await documentIntegration.publishContractDocument(supabase, customerFacing);
        if (contract.amendsContractId) {
          const priorDocumentId = await documentIntegration.getContractDocumentId(supabase, contract.amendsContractId);
          if (priorDocumentId) {
            await documentIntegration.recordAmendmentLineage(supabase, newDocumentId, priorDocumentId);
          }
        }
      } else {
        await documentIntegration.versionContractDocument(supabase, existingDocumentId, materialized.content, { type: "venue", id: venueId });
      }
    }

    const refreshed = await repo.getContract(supabase, venueId, id);
    await sendContractInviteEmails(refreshed ?? contract, customMessage);

    const cadence = await getReminderCadence();
    await createRemindersForContract(supabase, venueId, id, (refreshed ?? contract).expiresAt, cadence);

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

/**
 * Reopen-for-editing is retired after venue signature (content immutable).
 * Owner/Manager gate retained; repository always fails closed → Clone & Resend.
 */
export async function reopenContractForEditing(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can reopen a contract for editing." } as ContractActionResult;
    }
    const actor = await currentActor(venueId);
    const outcome = await repo.reopenForEditing(supabase, venueId, id, actor.userId, actor.label);
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

/**
 * Create New Version — product entry point for locked contracts.
 * Reuses cloneAndResendContract (new contract id, fresh signers, amends_contract_id).
 * Does not mutate the source. Does not copy signing evidence.
 */
export async function createNewVersionFromContract(sourceContractId: string): Promise<CreateContractResult> {
  return cloneAndResendContract(sourceContractId);
}

/**
 * Clone engine used by Create New Version.
 * Creates a NEW draft with copied content/client/event; fresh signers/tokens;
 * original remains completely unchanged. Uses amends_contract_id for lineage.
 */
export async function cloneAndResendContract(sourceContractId: string): Promise<CreateContractResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const source = await repo.getContract(supabase, venueId, sourceContractId);
    if (!source) return { ok: false, message: "Original contract not found." } as CreateContractResult;
    if (source.executionOrigin === "external") {
      return {
        ok: false,
        message: "Externally executed agreements cannot start a new Hello to Cheers signing version. Attach a revised signed file as a document instead.",
      } as CreateContractResult;
    }

    const anyClientSigned = (source.signers ?? []).some(
      (s) => s.signerType === "client" && s.signedAt != null,
    );
    const venueSigned = (source.signers ?? []).some(
      (s) => s.signerType === "venue" && s.signedAt != null,
    );
    if (!venueSigned && !anyClientSigned && source.status !== "signed") {
      return {
        ok: false,
        message: "Create New Version is available after the client has signed (so the signed version is preserved).",
      } as CreateContractResult;
    }

    if (!source.clientId) {
      return { ok: false, message: "This contract has no client — cannot create a new version." } as CreateContractResult;
    }

    const seeds = await resolveClientSignerSeedsFromPersistedSigners(
      source.clientId,
      source.signers ?? [],
    );
    if (!seeds.ok) return { ok: false, message: seeds.message } as CreateContractResult;

    const newContractId = await repo.insertContract(supabase, venueId, {
      templateId: source.templateId ?? "",
      clientId: source.clientId,
      eventId: source.eventId ?? "",
      title: source.title,
      content: source.content,
      amendsContractId: sourceContractId,
    });
    await repo.insertContractSigners(supabase, venueId, newContractId, seeds.seeds);
    const actor = await currentActor(venueId);
    await repo.insertContractActivity(
      supabase, venueId, newContractId, "contract_created",
      `New version of "${source.title}"`,
      "New draft for a revised signing cycle. The original contract remains unchanged.",
      actor.userId, actor.label,
    );

    return { ok: true, contractId: newContractId } as CreateContractResult;
  });
  return result as CreateContractResult;
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
      const adminForReminders = createAdminClient();
      await cancelRemindersForContract(adminForReminders as never, contractRow.venueId, contractRow.id);
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
    const adminForReminders = createAdminClient();
    await cancelRemindersForContract(adminForReminders as never, contractRow.venueId, contractRow.id);
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

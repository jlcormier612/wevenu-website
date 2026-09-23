import { randomBytes } from "crypto";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/commercial-proposals/repository";
import type {
  ClientChoiceInput,
  CommercialProposal,
  CreateProposalInput,
} from "@/lib/commercial-proposals/types";
import { validateClientChoices } from "@/lib/commercial-proposals/types";
import { suggestDepositAmount, roundMoney } from "@/lib/commercial-selections/constants";
import { evaluatePackageEligibility } from "@/lib/packages/eligibility";
import { getPackage, getPackagesWithItems } from "@/lib/packages/service";
import type { PackageWithItems } from "@/lib/packages/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { createAdminClient } from "@/integrations/supabase/admin";

export type ProposalActionResult =
  | { ok: true; proposalId?: string }
  | { ok: false; message: string };

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | ProposalActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function listEligiblePackagesForContext(ctx: {
  eventType?: string | null;
  guestCount?: number | null;
  spaceId?: string | null;
}): Promise<PackageWithItems[]> {
  const packages = await getPackagesWithItems(true);
  return packages.filter((p) =>
    evaluatePackageEligibility(
      {
        isActive: p.isActive,
        basePrice: p.basePrice,
        offerRole: p.offerRole,
        eligibleEventTypes: p.eligibleEventTypes,
        minGuestCount: p.minGuestCount,
        maxGuestCount: p.maxGuestCount,
        eligibleSpaceIds: p.eligibleSpaceIds,
      },
      ctx,
    ).eligible,
  );
}

/**
 * Create a draft multi-option proposal. Prices are snapshotted from catalog now;
 * freeze stamp is set on send so later catalog edits cannot change offered prices.
 */
export async function createCommercialProposal(
  input: CreateProposalInput,
): Promise<{ ok: true; proposalId: string } | { ok: false; message: string }> {
  if (!input.leadId && !input.clientId) {
    return { ok: false, message: "A lead or client is required." };
  }
  if (!input.options?.length) {
    return { ok: false, message: "Choose at least one package or option to offer." };
  }
  const primaryCount = input.options.filter((o) => o.offerRole === "primary").length;
  if (primaryCount < 1) {
    return { ok: false, message: "Include at least one package choice (not only add-ons)." };
  }

  const result = await withVenue(async (supabase, venueId) => {
    const ctx = input.eligibilityContext ?? {};
    const optionRows: {
      packageId: string;
      offerRole: "primary" | "addon";
      pkg: PackageWithItems;
    }[] = [];

    for (const draft of input.options) {
      const pkg = await getPackage(draft.packageId);
      if (!pkg) return { ok: false, message: "A selected package was not found." } as ProposalActionResult;
      const elig = evaluatePackageEligibility(
        {
          isActive: pkg.isActive,
          basePrice: pkg.basePrice,
          offerRole: draft.offerRole,
          eligibleEventTypes: pkg.eligibleEventTypes,
          minGuestCount: pkg.minGuestCount,
          maxGuestCount: pkg.maxGuestCount,
          eligibleSpaceIds: pkg.eligibleSpaceIds,
        },
        ctx,
      );
      if (!elig.eligible) {
        return {
          ok: false,
          message: `"${pkg.name}" is not eligible for this opportunity.`,
        } as ProposalActionResult;
      }
      if (pkg.basePrice == null || !(pkg.basePrice > 0)) {
        return { ok: false, message: `"${pkg.name}" needs a price before it can be offered.` } as ProposalActionResult;
      }
      optionRows.push({ packageId: pkg.id, offerRole: draft.offerRole, pkg });
    }

    const maxPrimary = Math.max(
      ...optionRows.filter((o) => o.offerRole === "primary").map((o) => Number(o.pkg.basePrice)),
      0,
    );
    const depositAmount = roundMoney(
      input.depositAmount != null
        ? input.depositAmount
        : suggestDepositAmount(maxPrimary, null),
    );

    // Supersede prior open proposals for this lead/client
    if (input.clientId) {
      const prev = await repo.getActiveProposalForClient(supabase, venueId, input.clientId);
      if (prev && prev.status !== "approved") {
        await repo.supersedeProposal(supabase, venueId, prev.id);
      }
    } else if (input.leadId) {
      const prev = await repo.getActiveProposalForLead(supabase, venueId, input.leadId);
      if (prev && prev.status !== "approved") {
        await repo.supersedeProposal(supabase, venueId, prev.id);
      }
    }

    const proposal = await repo.insertProposal(supabase, venueId, {
      leadId: input.leadId,
      clientId: input.clientId,
      eventId: input.eventId,
      depositAmount,
      offerMessage: input.message?.trim() || null,
      eligibilityContext: ctx as Record<string, unknown>,
    });

    let sort = 0;
    for (const row of optionRows) {
      await repo.insertProposalOption(supabase, venueId, proposal.id, {
        sourcePackageId: row.pkg.id,
        offerRole: row.offerRole,
        name: row.pkg.name,
        description: row.pkg.description,
        unitPrice: Number(row.pkg.basePrice),
        includedItems: row.pkg.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
        })),
        sortOrder: sort++,
        frozenAt: null,
      });
    }

    return { ok: true, proposalId: proposal.id } as { ok: true; proposalId: string };
  });
  if (!result || typeof result !== "object") {
    return { ok: false, message: "Could not create the proposal." };
  }
  if ("ok" in result && result.ok === false) {
    return { ok: false, message: result.message ?? "Could not create the proposal." };
  }
  if ("ok" in result && result.ok === true && "proposalId" in result && result.proposalId) {
    return { ok: true, proposalId: String(result.proposalId) };
  }
  return { ok: false, message: "Could not create the proposal." };
}

export async function sendCommercialProposal(input: {
  proposalId: string;
  message?: string;
}): Promise<
  | { ok: true; acceptToken: string; proposal: CommercialProposal }
  | ProposalActionResult
> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getProposal(supabase, venueId, input.proposalId);
    if (!existing) return { ok: false, message: "Proposal not found." } as ProposalActionResult;
    if (existing.status === "approved") {
      return { ok: false, message: "This proposal was already approved." } as ProposalActionResult;
    }
    if (existing.status === "superseded" || existing.status === "withdrawn") {
      return { ok: false, message: "This proposal is no longer active." } as ProposalActionResult;
    }
    if (existing.options.length === 0) {
      return { ok: false, message: "Add at least one option before sending." } as ProposalActionResult;
    }
    if (!existing.options.some((o) => o.offerRole === "primary")) {
      return { ok: false, message: "Include at least one package choice." } as ProposalActionResult;
    }

    const acceptToken = existing.acceptToken ?? randomBytes(24).toString("hex");
    const updated = await repo.markProposalSent(
      supabase,
      venueId,
      existing.id,
      acceptToken,
      input.message?.trim() || existing.offerMessage,
    );
    if (!updated) return { ok: false, message: "Could not send the proposal." } as ProposalActionResult;

    // Activity: proposal sent
    try {
      const title = `Proposal sent with ${updated.options.length} option${updated.options.length === 1 ? "" : "s"}.`;
      if (updated.leadId) {
        const { insertActivity } = await import("@/lib/leads/repository");
        await insertActivity(supabase, venueId, updated.leadId, "proposal_sent", title, undefined);
      } else if (updated.clientId) {
        const { insertClientActivity } = await import("@/lib/clients/repository");
        await insertClientActivity(supabase, venueId, updated.clientId, "proposal_sent", title, undefined);
      }
      const link = updated.clientId
        ? `/clients/${updated.clientId}`
        : updated.leadId
          ? `/leads/${updated.leadId}`
          : null;
      try {
        await supabase.rpc("create_venue_notification", {
          p_venue_id: venueId,
          p_event_id: updated.eventId,
          p_type: "proposal_sent",
          p_title: title,
          p_body: null,
          p_link: link,
          p_emoji: null,
        });
      } catch {
        /* optional */
      }
    } catch {
      /* proposal already sent */
    }

    return { ok: true, acceptToken, proposal: updated };
  });
  return result as
    | { ok: true; acceptToken: string; proposal: CommercialProposal }
    | ProposalActionResult;
}

export async function getProposalForVenue(proposalId: string): Promise<CommercialProposal | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getProposal(await createClient(), venue.id, proposalId);
}

export async function resolveActiveProposal(input: {
  leadId?: string;
  clientId?: string;
}): Promise<CommercialProposal | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  if (input.clientId) return repo.getActiveProposalForClient(supabase, venue.id, input.clientId);
  if (input.leadId) return repo.getActiveProposalForLead(supabase, venue.id, input.leadId);
  return null;
}

/** Public couple APIs — token scoped via SECURITY DEFINER RPCs. */
export async function getProposalByToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_commercial_proposal_by_accept_token", {
    p_token: token,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.error) return null;
  return row;
}

export async function selectProposalByToken(
  token: string,
  choices: ClientChoiceInput[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const offer = await getProposalByToken(token);
  if (!offer) return { ok: false, message: "This proposal link is not valid." };
  const options = Array.isArray(offer.options)
    ? (offer.options as { id: string; offerRole: "primary" | "addon" }[]).map((o) => ({
        id: String(o.id),
        offerRole: o.offerRole,
      }))
    : [];
  const valid = validateClientChoices(options, choices);
  if (!valid.ok) return valid;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("select_commercial_proposal", {
    p_token: token,
    p_choices: choices.map((c) => ({
      optionId: c.optionId,
      quantity: c.quantity ?? 1,
    })),
  });
  if (error || !data || typeof data !== "object") {
    return { ok: false, message: "Could not save your selection." };
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    const err = String(row.error ?? "");
    if (err === "already_approved") return { ok: false, message: "This proposal was already approved." };
    if (err === "need_one_primary") return { ok: false, message: "Choose exactly one package." };
    if (err === "empty_selection") return { ok: false, message: "Choose a package to continue." };
    return { ok: false, message: "Could not save your selection." };
  }
  return { ok: true };
}

export async function approveProposalByToken(
  token: string,
  choices?: ClientChoiceInput[],
): Promise<
  | { ok: true; selectionId?: string; alreadyApproved?: boolean }
  | { ok: false; message: string }
> {
  // If choices provided, persist selection first (select + approve in one client action).
  if (choices && choices.length > 0) {
    const selected = await selectProposalByToken(token, choices);
    if (!selected.ok) return selected;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("approve_commercial_proposal", { p_token: token });
  if (error || !data || typeof data !== "object") {
    return { ok: false, message: "Could not approve this proposal." };
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    const err = String(row.error ?? "");
    if (err === "no_selection") return { ok: false, message: "Choose a package before approving." };
    if (err === "need_one_primary") return { ok: false, message: "Choose exactly one package." };
    if (err === "already_approved") {
      return { ok: true, selectionId: row.selectionId ? String(row.selectionId) : undefined, alreadyApproved: true };
    }
    if (err === "invalid_token") return { ok: false, message: "This proposal link is not valid." };
    return { ok: false, message: "Could not approve this proposal." };
  }
  return {
    ok: true,
    selectionId: row.selectionId ? String(row.selectionId) : undefined,
    alreadyApproved: row.alreadyApproved === true,
  };
}

import { randomBytes } from "crypto";

import { createClient } from "@/integrations/supabase/server";
import {
  remainingAmount,
  roundMoney,
  suggestDepositAmount,
} from "@/lib/commercial-selections/constants";
import * as repo from "@/lib/commercial-selections/repository";
import type {
  CommercialSelection,
  CommercialSelectionActionResult,
  CommercialSelectionErrors,
  CreateCommercialSelectionResult,
} from "@/lib/commercial-selections/types";
import { isSupabaseConfigured } from "@/lib/env";
import { getPackage } from "@/lib/packages/service";
import { getCurrentVenue } from "@/lib/venue/service";

function validateAmounts(
  totalAmount: number,
  depositAmount: number,
): CommercialSelectionErrors | null {
  if (!(totalAmount > 0) || Number.isNaN(totalAmount)) {
    return { totalAmount: "Enter a package price greater than zero." };
  }
  if (Number.isNaN(depositAmount) || depositAmount < 0) {
    return { depositAmount: "Enter a valid deposit amount." };
  }
  if (depositAmount > totalAmount) {
    return { depositAmount: "Deposit cannot exceed the package total." };
  }
  return null;
}

async function withVenue<T>(
  fn: (c: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | CommercialSelectionActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getActiveSelectedPackageForLead(
  leadId: string,
): Promise<CommercialSelection | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getActiveSelectionForLead(await createClient(), venue.id, leadId);
}

export async function getActiveSelectedPackageForClient(
  clientId: string,
): Promise<CommercialSelection | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getActiveSelectionForClient(await createClient(), venue.id, clientId);
}

export async function getActiveSelectedPackageForEvent(
  eventId: string,
): Promise<CommercialSelection | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getActiveSelectionForEvent(await createClient(), venue.id, eventId);
}

export async function getSelectedPackage(
  id: string,
): Promise<CommercialSelection | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getSelection(await createClient(), venue.id, id);
}

/**
 * Create a frozen Selected Package from a Library package.
 * If an active selection already exists for this lead/client, it is superseded.
 */
export async function createSelectedPackageFromLibrary(input: {
  packageId: string;
  leadId?: string;
  clientId?: string;
  eventId?: string;
  depositAmount?: number;
  venueDefaultDeposit?: number | null;
}): Promise<CreateCommercialSelectionResult> {
  if (!input.leadId && !input.clientId) {
    return { ok: false, message: "A lead or client is required." };
  }
  const pkg = await getPackage(input.packageId);
  if (!pkg || !pkg.isActive) {
    return { ok: false, message: "That package is not available." };
  }
  if (pkg.basePrice == null || !(pkg.basePrice > 0)) {
    return { ok: false, message: "Set a price on this package in the Library before selecting it." };
  }
  const totalAmount = roundMoney(pkg.basePrice);
  const depositAmount = roundMoney(
    input.depositAmount != null
      ? input.depositAmount
      : suggestDepositAmount(totalAmount, input.venueDefaultDeposit),
  );
  const amountErrors = validateAmounts(totalAmount, depositAmount);
  if (amountErrors) return { ok: false, errors: amountErrors };

  const includedItems = pkg.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
  }));

  const result = await withVenue(async (supabase, venueId) => {
    let previous: CommercialSelection | null = null;
    if (input.clientId) {
      previous = await repo.getActiveSelectionForClient(supabase, venueId, input.clientId);
    } else if (input.leadId) {
      previous = await repo.getActiveSelectionForLead(supabase, venueId, input.leadId);
    }

    const next = previous
      ? await repo.bumpVersion(supabase, venueId, {
          leadId: input.leadId ?? previous.leadId ?? undefined,
          clientId: input.clientId ?? previous.clientId ?? undefined,
          eventId: input.eventId ?? previous.eventId ?? undefined,
          sourcePackageId: pkg.id,
          name: pkg.name,
          totalAmount,
          depositAmount,
          includedItems,
          version: previous.version + 1,
        })
      : await repo.insertSelection(supabase, venueId, {
          leadId: input.leadId,
          clientId: input.clientId,
          eventId: input.eventId,
          sourcePackageId: pkg.id,
          name: pkg.name,
          totalAmount,
          depositAmount,
          includedItems,
        });

    if (previous) {
      await repo.supersedeSelection(supabase, venueId, previous.id, next);
    }
    return { ok: true, selectionId: next.id } as CreateCommercialSelectionResult;
  });
  return result as CreateCommercialSelectionResult;
}

export async function attachSelectionToBookingFile(
  selectionId: string,
  links: { clientId: string; eventId?: string | null; leadId?: string | null },
): Promise<CommercialSelectionActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getSelection(supabase, venueId, selectionId);
    if (!existing) return { ok: false, message: "Selected package not found." } as CommercialSelectionActionResult;
    await repo.updateSelectionLinks(supabase, venueId, selectionId, {
      clientId: links.clientId,
      eventId: links.eventId ?? existing.eventId,
      leadId: links.leadId !== undefined ? links.leadId : existing.leadId,
    });
    return { ok: true } as CommercialSelectionActionResult;
  });
  return result as CommercialSelectionActionResult;
}

export async function sendOfferForSelection(input: {
  selectionId: string;
  message?: string;
}): Promise<
  | { ok: true; acceptToken: string; selection: CommercialSelection }
  | CommercialSelectionActionResult
> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getSelection(supabase, venueId, input.selectionId);
    if (!existing) return { ok: false, message: "Selected package not found." };
    if (existing.status === "superseded") {
      return { ok: false, message: "This selected package was replaced. Choose a package again." };
    }
    if (existing.status === "accepted") {
      return { ok: false, message: "This offer was already accepted." };
    }
    const acceptToken = existing.acceptToken ?? randomBytes(24).toString("hex");
    const updated = await repo.markOffered(
      supabase,
      venueId,
      existing.id,
      acceptToken,
      input.message?.trim() || null,
    );
    if (!updated) return { ok: false, message: "Could not send the offer." };
    return { ok: true, acceptToken, selection: updated };
  });
  return result as
    | { ok: true; acceptToken: string; selection: CommercialSelection }
    | CommercialSelectionActionResult;
}

/** Venue-side offline acceptance (secondary action). */
export async function markSelectionAccepted(
  selectionId: string,
): Promise<CommercialSelectionActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getSelection(supabase, venueId, selectionId);
    if (!existing) return { ok: false, message: "Selected package not found." };
    if (existing.status === "accepted") return { ok: true };
    if (existing.status === "superseded") {
      return { ok: false, message: "This selected package was replaced." };
    }
    const updated = await repo.markAcceptedVenue(supabase, venueId, selectionId);
    if (!updated) return { ok: false, message: "Could not mark as accepted." };
    if (existing.clientId) {
      const { maybeStampCommercialBookedAt } = await import("@/lib/booking-journey/stamp-commercial-booked-at");
      await maybeStampCommercialBookedAt(supabase, venueId, {
        clientId: existing.clientId,
        eventId: existing.eventId,
      });
    }
    return { ok: true };
  });
  return result as CommercialSelectionActionResult;
}

export async function linkSelectionInvoice(
  selectionId: string,
  invoiceId: string,
): Promise<CommercialSelectionActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateSelectionLinks(supabase, venueId, selectionId, { invoiceId });
    return { ok: true } as CommercialSelectionActionResult;
  });
  return result as CommercialSelectionActionResult;
}

export async function linkSelectionContract(
  selectionId: string,
  contractId: string,
): Promise<CommercialSelectionActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateSelectionLinks(supabase, venueId, selectionId, { contractId });
    return { ok: true } as CommercialSelectionActionResult;
  });
  return result as CommercialSelectionActionResult;
}

export { remainingAmount, suggestDepositAmount, roundMoney };

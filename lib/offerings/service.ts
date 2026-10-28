import { createClient } from "@/integrations/supabase/server";
import { findOrCreateOfferingCategory } from "@/lib/offerings/category-identity";
import * as repo from "@/lib/offerings/repository";
import type {
  CreateOfferingCategoryResult, CreateOfferingResult, Offering, OfferingActionResult,
  OfferingCategory, OfferingInput, OfferingWithCategory,
} from "@/lib/offerings/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (client: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  return fn(supabase, venue.id);
}

export async function listOfferings(includeArchived = true): Promise<OfferingWithCategory[]> {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return repo.getOfferingsWithCategory(supabase, venue.id);
}

export async function listActiveOfferings(): Promise<Offering[]> {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return repo.getOfferings(supabase, venue.id, { includeArchived: false });
}

export async function listOfferingCategories(): Promise<OfferingCategory[]> {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return repo.getCategories(supabase, venue.id);
}

export async function createOfferingCategory(name: string): Promise<CreateOfferingCategoryResult> {
  if (!name.trim()) return { ok: false, message: "Category name is required." };
  const result = await withVenue(async (c, venueId) => {
    const ensured = await findOrCreateOfferingCategory(c, venueId, name);
    return { ok: true as const, categoryId: ensured.id };
  });
  return result as CreateOfferingCategoryResult;
}

function offeringWriteErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/same category/i.test(raw)) return "Major choices must be in the same service category.";
  if (/one nesting level|top-level major|already a major/i.test(raw)) {
    return "Only top-level major choices can have items under them, and nesting is one level.";
  }
  if (/same venue|venue_id must match/i.test(raw)) return "Offerings must stay within this venue.";
  if (/parent offering not found|offering not found/i.test(raw)) return "Selected major choice was not found.";
  return raw.slice(0, 200) || "Could not save offering.";
}

export async function createOffering(input: OfferingInput): Promise<CreateOfferingResult> {
  if (!input.name.trim()) return { ok: false, message: "Name is required." };
  const result = await withVenue(async (c, venueId) => {
    try {
      const offeringId = await repo.insertOffering(c, venueId, input);
      return { ok: true as const, offeringId };
    } catch (err) {
      return { ok: false as const, message: offeringWriteErrorMessage(err) };
    }
  });
  return result as CreateOfferingResult;
}

export async function updateOffering(id: string, input: OfferingInput): Promise<OfferingActionResult> {
  if (!input.name.trim()) return { ok: false, message: "Name is required." };
  const result = await withVenue(async (c, venueId) => {
    try {
      await repo.updateOffering(c, venueId, id, input);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, message: offeringWriteErrorMessage(err) };
    }
  });
  return result as OfferingActionResult;
}

export async function setOfferingArchived(id: string, archived: boolean): Promise<OfferingActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.setOfferingArchived(c, venueId, id, archived);
    return { ok: true as const };
  });
  return result as OfferingActionResult;
}

export async function getOffering(id: string): Promise<Offering | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.getOffering(supabase, venue.id, id);
}

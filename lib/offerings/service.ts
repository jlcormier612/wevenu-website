import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import * as repo from "@/lib/offerings/repository";
import type {
  CreateOfferingCategoryResult, CreateOfferingResult, Offering, OfferingActionResult,
  OfferingCategory, OfferingInput, OfferingWithCategory,
} from "@/lib/offerings/types";

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
    const categoryId = await repo.insertCategory(c, venueId, name);
    return { ok: true as const, categoryId };
  });
  return result as CreateOfferingCategoryResult;
}

export async function createOffering(input: OfferingInput): Promise<CreateOfferingResult> {
  if (!input.name.trim()) return { ok: false, message: "Name is required." };
  const result = await withVenue(async (c, venueId) => {
    const offeringId = await repo.insertOffering(c, venueId, input);
    return { ok: true as const, offeringId };
  });
  return result as CreateOfferingResult;
}

export async function updateOffering(id: string, input: OfferingInput): Promise<OfferingActionResult> {
  if (!input.name.trim()) return { ok: false, message: "Name is required." };
  const result = await withVenue(async (c, venueId) => {
    await repo.updateOffering(c, venueId, id, input);
    return { ok: true as const };
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

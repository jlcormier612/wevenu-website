import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/packages/repository";
import { parsePackagePriceInput } from "@/lib/packages/constants";
import type { CreatePackageResult, PackageActionResult, PackageErrors, PackageInput, PackageItemInput, PackageWithItems } from "@/lib/packages/types";
import type { Package } from "@/lib/packages/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { requireAdminUser } from "@/lib/hq/crm-service";

function validatePackageInput(input: PackageInput): PackageErrors | null {
  if (!input.name.trim()) return { name: "Package name is required." };
  const price = parsePackagePriceInput(input.basePrice);
  if (typeof price === "number" && Number.isNaN(price)) {
    return { basePrice: "Enter a valid price, or leave blank until you set one." };
  }
  if (typeof price === "number" && price < 0) {
    return { basePrice: "Price cannot be negative." };
  }
  return null;
}

async function withVenue<T>(fn: (c: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>): Promise<T | PackageActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getPackages(activeOnly = false): Promise<Package[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getPackages(await createClient(), venue.id, activeOnly);
}

export async function getPackagesWithItems(activeOnly = false): Promise<PackageWithItems[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getPackagesWithItems(await createClient(), venue.id, activeOnly);
}

export async function getPackage(id: string): Promise<PackageWithItems | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getPackage(await createClient(), venue.id, id);
}

export async function addPackageItem(packageId: string, input: PackageItemInput): Promise<{ ok: true; item: import("@/lib/packages/types").PackageItem } | PackageActionResult> {
  if (!input.description.trim()) return { ok: false, message: "Description is required." };
  const result = await withVenue(async (c, venueId) => {
    try {
      const item = await repo.insertPackageItem(c, venueId, packageId, input);
      return { ok: true, item };
    } catch (e) {
      const message = String((e as { message?: unknown })?.message ?? e);
      if (message.includes("offering_not_in_venue")) return { ok: false, message: "That offering is not in this venue's catalog." };
      throw e;
    }
  });
  return result as { ok: true; item: import("@/lib/packages/types").PackageItem } | PackageActionResult;
}

export async function setPackageItemQuantity(
  itemId: string,
  quantity: number,
  perGuest: boolean,
): Promise<{ ok: true; item: import("@/lib/packages/types").PackageItem } | PackageActionResult> {
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, message: "Enter a quantity above zero." };
  const result = await withVenue(async (c, venueId) => {
    const item = await repo.setPackageItemQuantity(c, venueId, itemId, quantity, perGuest);
    if (!item) return { ok: false, message: "Inclusion not found." };
    return { ok: true, item };
  });
  return result as { ok: true; item: import("@/lib/packages/types").PackageItem } | PackageActionResult;
}

export async function linkPackageItemOffering(
  itemId: string,
  offeringId: string | null,
): Promise<{ ok: true; item: import("@/lib/packages/types").PackageItem } | PackageActionResult> {
  const result = await withVenue(async (c, venueId) => {
    try {
      const item = await repo.setPackageItemOffering(c, venueId, itemId, offeringId || null);
      if (!item) return { ok: false, message: "Inclusion not found." };
      return { ok: true, item };
    } catch (e) {
      const message = String((e as { message?: unknown })?.message ?? e);
      if (message.includes("offering_not_in_venue")) return { ok: false, message: "That offering is not in this venue's catalog." };
      throw e;
    }
  });
  return result as { ok: true; item: import("@/lib/packages/types").PackageItem } | PackageActionResult;
}

export async function removePackageItem(itemId: string): Promise<PackageActionResult> {
  const result = await withVenue(async (c, venueId) => repo.deletePackageItem(c, venueId, itemId));
  return result as PackageActionResult;
}

/** Migration Center — mirrors lib/leads/service.ts's findActiveDuplicateLead(). */
export async function findActiveDuplicatePackage(name: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.findActiveDuplicatePackage(supabase, venue.id, name);
}

/** White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see createClientForVenue's doc comment (lib/clients/service.ts) for the pattern this mirrors. */
export async function findActiveDuplicatePackageForVenue(venueId: string, name: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const actor = await requireAdminUser();
  if (!actor) return null;
  return repo.findActiveDuplicatePackage(createAdminClient(), venueId, name);
}

export async function createPackage(input: PackageInput): Promise<CreatePackageResult> {
  const errors = validatePackageInput(input);
  if (errors) return { ok: false, errors };
  const result = await withVenue(async (c, venueId) => {
    const packageId = await repo.insertPackage(c, venueId, input);
    return { ok: true, packageId } as CreatePackageResult;
  });
  return result as CreatePackageResult;
}

/** White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see createClientForVenue's doc comment for the pattern this mirrors. */
export async function createPackageForVenue(venueId: string, input: PackageInput): Promise<CreatePackageResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const errors = validatePackageInput(input);
  if (errors) return { ok: false, errors };
  const packageId = await repo.insertPackage(createAdminClient(), venueId, input);
  return { ok: true, packageId };
}

/** Append composition lines after package create (Import Data / Migration Center). */
export async function addPackageItems(
  packageId: string,
  items: PackageItemInput[],
): Promise<PackageActionResult> {
  if (items.length === 0) return { ok: true };
  for (const item of items) {
    if (!item.description.trim()) return { ok: false, message: "Each included item needs a description." };
  }
  const result = await withVenue(async (c, venueId) => {
    for (const item of items) {
      await repo.insertPackageItem(c, venueId, packageId, item);
    }
    return { ok: true } as PackageActionResult;
  });
  return result as PackageActionResult;
}

export async function addPackageItemsForVenue(
  venueId: string,
  packageId: string,
  items: PackageItemInput[],
): Promise<PackageActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  if (items.length === 0) return { ok: true };
  for (const item of items) {
    if (!item.description.trim()) return { ok: false, message: "Each included item needs a description." };
  }
  const admin = createAdminClient();
  for (const item of items) {
    await repo.insertPackageItem(admin, venueId, packageId, item);
  }
  return { ok: true };
}

export async function updatePackage_(id: string, input: PackageInput): Promise<PackageActionResult> {
  const errors = validatePackageInput(input);
  if (errors) return { ok: false, errors };
  const result = await withVenue(async (c, venueId) => {
    await repo.updatePackage(c, venueId, id, input);
    return { ok: true } as PackageActionResult;
  });
  return result as PackageActionResult;
}

export async function deletePackage_(id: string): Promise<PackageActionResult> {
  const result = await withVenue(async (c, venueId) => repo.deletePackage(c, venueId, id));
  return result as PackageActionResult;
}

export async function duplicatePackage_(id: string, newName: string): Promise<CreatePackageResult> {
  const result = await withVenue(async (c, venueId) => {
    const packageId = await repo.duplicatePackage(c, venueId, id, newName);
    return { ok: true, packageId } as CreatePackageResult;
  });
  return result as CreatePackageResult;
}

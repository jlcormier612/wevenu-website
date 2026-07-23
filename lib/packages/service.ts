import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/packages/repository";
import type { CreatePackageResult, PackageActionResult, PackageInput, PackageItemInput, PackageWithItems } from "@/lib/packages/types";
import type { Package } from "@/lib/packages/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { requireAdminUser } from "@/lib/hq/crm-service";

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

export async function getPackage(id: string): Promise<PackageWithItems | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getPackage(await createClient(), venue.id, id);
}

export async function addPackageItem(packageId: string, input: PackageItemInput): Promise<{ ok: true; item: import("@/lib/packages/types").PackageItem } | PackageActionResult> {
  if (!input.description.trim()) return { ok: false, message: "Description is required." };
  const result = await withVenue(async (c, venueId) => {
    const item = await repo.insertPackageItem(c, venueId, packageId, input);
    return { ok: true, item };
  });
  return result as { ok: true; item: import("@/lib/packages/types").PackageItem } | PackageActionResult;
}

export async function removePackageItem(itemId: string): Promise<PackageActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.deletePackageItem(c, venueId, itemId);
    return { ok: true } as PackageActionResult;
  });
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
  if (!input.name.trim()) return { ok: false, errors: { name: "Package name is required." } };
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
  if (!input.name.trim()) return { ok: false, errors: { name: "Package name is required." } };
  const packageId = await repo.insertPackage(createAdminClient(), venueId, input);
  return { ok: true, packageId };
}

export async function updatePackage_(id: string, input: PackageInput): Promise<PackageActionResult> {
  if (!input.name.trim()) return { ok: false, errors: { name: "Package name is required." } };
  const result = await withVenue(async (c, venueId) => {
    await repo.updatePackage(c, venueId, id, input);
    return { ok: true } as PackageActionResult;
  });
  return result as PackageActionResult;
}

export async function deletePackage_(id: string): Promise<PackageActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.deletePackage(c, venueId, id);
    return { ok: true } as PackageActionResult;
  });
  return result as PackageActionResult;
}

export async function duplicatePackage_(id: string, newName: string): Promise<CreatePackageResult> {
  const result = await withVenue(async (c, venueId) => {
    const packageId = await repo.duplicatePackage(c, venueId, id, newName);
    return { ok: true, packageId } as CreatePackageResult;
  });
  return result as CreatePackageResult;
}

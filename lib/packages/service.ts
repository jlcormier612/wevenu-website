import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/packages/repository";
import type { CreatePackageResult, PackageActionResult, PackageInput, PackageItemInput, PackageWithItems } from "@/lib/packages/types";
import type { Package } from "@/lib/packages/types";
import { getCurrentVenue } from "@/lib/venue/service";

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

export async function createPackage(input: PackageInput): Promise<CreatePackageResult> {
  if (!input.name.trim()) return { ok: false, errors: { name: "Package name is required." } };
  const result = await withVenue(async (c, venueId) => {
    const packageId = await repo.insertPackage(c, venueId, input);
    return { ok: true, packageId } as CreatePackageResult;
  });
  return result as CreatePackageResult;
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

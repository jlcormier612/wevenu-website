import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/packages/repository";
import type { CreatePackageResult, Package, PackageActionResult, PackageInput } from "@/lib/packages/types";
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

export async function getPackage(id: string): Promise<Package | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getPackage(await createClient(), venue.id, id);
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

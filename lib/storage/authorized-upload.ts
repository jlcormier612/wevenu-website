/**
 * Server-side authorized Storage upload/remove for venue (and vendor) staff.
 *
 * Uses the user-scoped Supabase client so existing Storage RLS still applies.
 * Never trusts a client-supplied venue/vendor id without matching session context.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient, createVendorClient } from "@/integrations/supabase/server";
import {
  CUSTOMER_UPLOAD_INVALID_MESSAGE,
  CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE,
  customerFacingUploadError,
} from "@/lib/storage/customer-upload-errors";
import { getCurrentVenue } from "@/lib/venue/service";

export const VENUE_STORAGE_BUCKETS = [
  "uploads",
  "documents",
  "floor-plans",
  "inventory",
] as const;

export const VENDOR_STORAGE_BUCKETS = ["vendors"] as const;

export type VenueStorageBucket = (typeof VENUE_STORAGE_BUCKETS)[number];
export type VendorStorageBucket = (typeof VENDOR_STORAGE_BUCKETS)[number];
export type StaffStorageBucket = VenueStorageBucket | VendorStorageBucket;

export type AuthScope = "venue" | "vendor";

const MAX_DEFAULT_BYTES = 25 * 1024 * 1024;

export type AuthorizedUploadResult =
  | { ok: true; path: string; publicUrl: string }
  | { ok: false; status: number; message: string };

export type AuthorizedRemoveResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

function isVenueBucket(bucket: string): bucket is VenueStorageBucket {
  return (VENUE_STORAGE_BUCKETS as readonly string[]).includes(bucket);
}

function isVendorBucket(bucket: string): bucket is VendorStorageBucket {
  return (VENDOR_STORAGE_BUCKETS as readonly string[]).includes(bucket);
}

function firstPathSegment(path: string): string | null {
  const cleaned = path.replace(/^\/+/, "");
  const seg = cleaned.split("/")[0]?.trim();
  return seg || null;
}

async function resolveVendorId(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("vendor_users")
    .select("vendor_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle<{ vendor_id: string }>();
  return data?.vendor_id ?? null;
}

/**
 * Upload a file with session-derived tenant context and user-scoped Storage RLS.
 */
export async function authorizedStaffStorageUpload(input: {
  scope: AuthScope;
  bucket: string;
  /** Full object path including extension. */
  path: string;
  file: File | Blob;
  contentType?: string | null;
  upsert?: boolean;
  maxBytes?: number;
}): Promise<AuthorizedUploadResult> {
  const maxBytes = input.maxBytes ?? MAX_DEFAULT_BYTES;
  if (input.file.size > maxBytes) {
    return { ok: false, status: 400, message: CUSTOMER_UPLOAD_INVALID_MESSAGE };
  }

  const path = input.path.replace(/^\/+/, "");
  const ownerSegment = firstPathSegment(path);
  if (!ownerSegment) {
    return { ok: false, status: 400, message: CUSTOMER_UPLOAD_INVALID_MESSAGE };
  }

  if (input.scope === "vendor") {
    if (!isVendorBucket(input.bucket)) {
      return { ok: false, status: 400, message: CUSTOMER_UPLOAD_INVALID_MESSAGE };
    }
    const supabase = await createVendorClient();
    const vendorId = await resolveVendorId(supabase);
    if (!vendorId) {
      return { ok: false, status: 401, message: CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE };
    }
    if (ownerSegment !== vendorId) {
      console.error("[storage/authorized-upload] vendor path mismatch", {
        ownerSegment,
        vendorId,
        bucket: input.bucket,
      });
      return { ok: false, status: 403, message: CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE };
    }
    return performUpload(supabase, input.bucket, path, input.file, input.contentType, input.upsert);
  }

  if (!isVenueBucket(input.bucket)) {
    return { ok: false, status: 400, message: CUSTOMER_UPLOAD_INVALID_MESSAGE };
  }
  const supabase = await createClient("venue");
  const venue = await getCurrentVenue();
  if (!venue) {
    return { ok: false, status: 401, message: CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE };
  }
  if (ownerSegment !== venue.id) {
    console.error("[storage/authorized-upload] venue path mismatch", {
      ownerSegment,
      venueId: venue.id,
      bucket: input.bucket,
    });
    return { ok: false, status: 403, message: CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE };
  }
  return performUpload(supabase, input.bucket, path, input.file, input.contentType, input.upsert);
}

export async function authorizedStaffStorageRemove(input: {
  scope: AuthScope;
  bucket: string;
  paths: string[];
}): Promise<AuthorizedRemoveResult> {
  const paths = input.paths.map((p) => p.replace(/^\/+/, "")).filter(Boolean);
  if (paths.length === 0) return { ok: true };

  if (input.scope === "vendor") {
    if (!isVendorBucket(input.bucket)) {
      return { ok: false, status: 400, message: CUSTOMER_UPLOAD_INVALID_MESSAGE };
    }
    const supabase = await createVendorClient();
    const vendorId = await resolveVendorId(supabase);
    if (!vendorId) {
      return { ok: false, status: 401, message: CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE };
    }
    for (const path of paths) {
      if (firstPathSegment(path) !== vendorId) {
        return { ok: false, status: 403, message: CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE };
      }
    }
    const { error } = await supabase.storage.from(input.bucket).remove(paths);
    if (error) {
      console.error("[storage/authorized-upload] vendor remove", error.message);
      return { ok: false, status: 500, message: customerFacingUploadError(error.message) };
    }
    return { ok: true };
  }

  if (!isVenueBucket(input.bucket)) {
    return { ok: false, status: 400, message: CUSTOMER_UPLOAD_INVALID_MESSAGE };
  }
  const supabase = await createClient("venue");
  const venue = await getCurrentVenue();
  if (!venue) {
    return { ok: false, status: 401, message: CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE };
  }
  for (const path of paths) {
    if (firstPathSegment(path) !== venue.id) {
      return { ok: false, status: 403, message: CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE };
    }
  }
  const { error } = await supabase.storage.from(input.bucket).remove(paths);
  if (error) {
    console.error("[storage/authorized-upload] venue remove", error.message);
    return { ok: false, status: 500, message: customerFacingUploadError(error.message) };
  }
  return { ok: true };
}

async function performUpload(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File | Blob,
  contentType: string | null | undefined,
  upsert: boolean | undefined,
): Promise<AuthorizedUploadResult> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: Boolean(upsert),
    contentType: contentType || undefined,
  });
  if (error) {
    console.error("[storage/authorized-upload] upload failed", {
      bucket,
      path,
      message: error.message,
    });
    return { ok: false, status: 400, message: customerFacingUploadError(error.message) };
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { ok: true, path, publicUrl: data.publicUrl };
}

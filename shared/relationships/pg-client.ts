/**
 * Supabase service-role client for the HTC Relationships CRM store.
 * Used only from marketing / workspace / shared server code — never client.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function crmSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url?.trim() && key?.trim());
}

/** Prefer Postgres when service-role credentials are present. */
export function usePostgresCrmStore(): boolean {
  if (process.env.HTC_CRM_STORE === "file") return false;
  if (process.env.HTC_CRM_STORE === "postgres") return true;
  return crmSupabaseConfigured();
}

export function createCrmAdminClient(): SupabaseClient {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error(
      "HTC CRM Postgres store requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

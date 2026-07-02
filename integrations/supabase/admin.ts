import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only operations that bypass RLS —
 * specifically Storage uploads where the caller authenticates via portal token,
 * not a Supabase session.
 *
 * NEVER import this in client-accessible code. Only use in Route Handlers
 * and Server Actions after validating the caller's portal token.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase admin credentials not configured. Set SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

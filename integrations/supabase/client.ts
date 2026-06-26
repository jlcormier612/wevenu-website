import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/env";

/**
 * Creates a Supabase client for use in browser (Client Component) contexts.
 * Only call this when `isSupabaseConfigured` is true.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey);
}

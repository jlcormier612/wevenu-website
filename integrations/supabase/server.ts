import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/env";

/**
 * Creates a Supabase client for use in Server Components, Server Actions and
 * Route Handlers. Reads/writes the session via Next.js cookies (async in
 * Next.js 16). Only call this when `isSupabaseConfigured` is true.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component. This can be
          // ignored when session refresh happens in the proxy (see proxy.ts).
        }
      },
    },
  });
}

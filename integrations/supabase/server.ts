import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import {
  cookieNameForScope,
  supabaseProjectRef,
  type AuthSessionScope,
} from "@/lib/auth/session-scope";
import { getSupabaseConfig } from "@/lib/env";

/**
 * Creates a Supabase client for Server Components, Server Actions and Route
 * Handlers. Scope selects which auth cookie jar to read/write:
 * - venue (default): staff workspace — library default cookie name
 * - vendor: vendor portal — isolated cookie name
 * - client: couple account login — isolated cookie name
 *
 * Call only when `isSupabaseConfigured` is true.
 */
export async function createClient(scope: AuthSessionScope = "venue") {
  const { url, anonKey } = getSupabaseConfig();
  const cookieStore = await cookies();
  const cookieName = cookieNameForScope(scope, supabaseProjectRef(url));

  return createServerClient(url, anonKey, {
    ...(cookieName ? { cookieOptions: { name: cookieName } } : null),
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

/** Vendor portal session — never shares venue staff cookies. */
export async function createVendorClient() {
  return createClient("vendor");
}

/** Couple / client account session — never shares venue staff cookies. */
export async function createClientPortalAuthClient() {
  return createClient("client");
}

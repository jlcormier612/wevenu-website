import { createBrowserClient } from "@supabase/ssr";

import {
  cookieNameForScope,
  supabaseProjectRef,
  type AuthSessionScope,
} from "@/lib/auth/session-scope";
import { getSupabaseConfig } from "@/lib/env";

const browserClients = new Map<AuthSessionScope, ReturnType<typeof createBrowserClient>>();

/**
 * Browser Supabase client. Scope selects the auth cookie jar (venue / vendor /
 * client). Clients are cached per scope so venue and vendor sessions do not
 * collapse into one singleton.
 */
export function createClient(scope: AuthSessionScope = "venue") {
  const cached = browserClients.get(scope);
  if (cached) return cached;

  const { url, anonKey } = getSupabaseConfig();
  const cookieName = cookieNameForScope(scope, supabaseProjectRef(url));

  const client = createBrowserClient(url, anonKey, {
    isSingleton: false,
    ...(cookieName ? { cookieOptions: { name: cookieName } } : null),
  });
  browserClients.set(scope, client);
  return client;
}

export function createVendorClient() {
  return createClient("vendor");
}

export function createClientPortalAuthClient() {
  return createClient("client");
}

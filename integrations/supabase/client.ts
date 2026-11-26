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
    cookieOptions: {
      // Prefer Secure + HttpOnly. Browser document.cookie cannot persist HttpOnly;
      // middleware/server clients rewrite the session cookie with HttpOnly on the
      // next request (Intuit session-cookie requirement).
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      ...(cookieName ? { name: cookieName } : null),
    },
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

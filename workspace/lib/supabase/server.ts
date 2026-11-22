import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  workspaceAuthCookieName,
  workspaceSupabaseAnonKey,
  workspaceSupabaseServiceRoleKey,
  workspaceSupabaseUrl,
} from "./workspace-auth-config";

/** Cookie-backed Workspace staff Auth client (isolated from venue/vendor/client). */
export async function createWorkspaceAuthClient() {
  const url = workspaceSupabaseUrl();
  const anonKey = workspaceSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error("Workspace Auth requires NEXT_PUBLIC_SUPABASE_URL and anon key.");
  }
  const cookieStore = await cookies();
  const cookieName = workspaceAuthCookieName();

  return createServerClient(url, anonKey, {
    cookieOptions: { name: cookieName },
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
          // Called from a Server Component — refresh happens in proxy.
        }
      },
    },
  });
}

/** Service-role admin client for invites / bootstrap / ACL writes. */
export function createWorkspaceAdminClient(): SupabaseClient {
  const url = workspaceSupabaseUrl();
  const key = workspaceSupabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      "Workspace admin Auth requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

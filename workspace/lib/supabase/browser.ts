"use client";

import { createBrowserClient } from "@supabase/ssr";

import {
  workspaceAuthCookieName,
  workspaceSupabaseAnonKey,
  workspaceSupabaseUrl,
} from "./workspace-auth-config";

/** Browser Workspace Auth client (isolated cookie jar). */
export function createWorkspaceBrowserClient() {
  const url = workspaceSupabaseUrl();
  const anonKey = workspaceSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error("Workspace Auth requires NEXT_PUBLIC_SUPABASE_URL and anon key.");
  }
  return createBrowserClient(url, anonKey, {
    cookieOptions: { name: workspaceAuthCookieName() },
  });
}

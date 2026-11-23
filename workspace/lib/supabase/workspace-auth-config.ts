/**
 * Workspace staff Auth configuration (R1A).
 * Cookie jar is isolated from venue / vendor / client scopes.
 */

export type WorkspaceAuthProvider = "supabase" | "legacy_jsonl" | "memory";

export function workspaceSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  );
}

export function workspaceSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function workspaceSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

export function workspaceAuthCookieName(): string {
  const url = workspaceSupabaseUrl();
  let ref = "htc";
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
    if (match?.[1]) ref = match[1];
  } catch {
    /* keep default */
  }
  return `sb-${ref}-workspace-auth-token`;
}

/**
 * Hosted Production must never silently fall back to JSONL auth.
 * Sandbox/local keep prior selection rules unless Production is selected.
 */
export function isProductionWorkspaceEnvironment(): boolean {
  const env = (process.env.HTC_ENVIRONMENT || process.env.HTC_ENV || "")
    .trim()
    .toLowerCase();
  return env === "production";
}

/**
 * Auth provider selection.
 * - `memory`: unit/integration tests (no live Supabase)
 * - `supabase`: Production-intended path (R1B+)
 * - `legacy_jsonl`: explicit emergency only — insecure for multi-task ECS
 *
 * Production (`HTC_ENVIRONMENT=production`): missing Supabase URL/anon key
 * resolves to `supabase` (fail-closed / unauthenticated) rather than JSONL,
 * unless `WORKSPACE_AUTH_PROVIDER=legacy_jsonl` is set explicitly.
 */
export function getWorkspaceAuthProvider(): WorkspaceAuthProvider {
  const raw = (process.env.WORKSPACE_AUTH_PROVIDER || "").trim().toLowerCase();
  if (raw === "legacy_jsonl" || raw === "jsonl") return "legacy_jsonl";
  if (raw === "memory") return "memory";
  if (raw === "supabase") return "supabase";
  if (process.env.NODE_ENV === "test") return "memory";
  if (workspaceSupabaseUrl() && workspaceSupabaseAnonKey()) return "supabase";
  if (isProductionWorkspaceEnvironment()) return "supabase";
  return "legacy_jsonl";
}

export function isLegacyJsonlAuthEnabled(): boolean {
  return getWorkspaceAuthProvider() === "legacy_jsonl";
}

export function isSupabaseStaffAuthEnabled(): boolean {
  const p = getWorkspaceAuthProvider();
  return p === "supabase" || p === "memory";
}

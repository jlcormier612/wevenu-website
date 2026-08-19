/**
 * Centralized access to public runtime environment variables.
 *
 * Hello to Cheers never hardcodes credentials. The Supabase URL and anon key are
 * supplied by the deployment environment (Vercel / local `.env.local`).
 *
 * The anon (publishable) key is safe to expose to the browser; it only grants
 * access permitted by Row Level Security policies. Service-role keys and other
 * secrets must NEVER be referenced from client-accessible code.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether the Supabase connection is configured in the current environment.
 *
 * When false (e.g. local development before infrastructure is provisioned),
 * the application still runs: the auth UI renders and protected routes redirect
 * to the login screen. Live credentials are an expected infrastructure
 * dependency, not a product blocker.
 *
 * Browser bundles can only see NEXT_PUBLIC_* values, and those must appear as
 * direct `process.env.NEXT_PUBLIC_*` identifiers so Next can inline them at
 * `next build`. Server code still falls back to SUPABASE_URL / SUPABASE_ANON_KEY
 * from the ECS runtime, because Next inlines NEXT_PUBLIC_* into the server
 * bundle at build time and would otherwise ignore later runtime values.
 */
export const isSupabaseConfigured = Boolean(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
);

/**
 * Returns the validated Supabase config or throws. Call only after confirming
 * `isSupabaseConfigured` (or where a missing config is genuinely fatal).
 */
export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.",
    );
  }
  return { url, anonKey };
}

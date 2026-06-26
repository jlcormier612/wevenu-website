/**
 * Centralized access to public runtime environment variables.
 *
 * Wevenu never hardcodes credentials. The Supabase URL and anon key are
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
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Returns the validated Supabase config or throws. Call only after confirming
 * `isSupabaseConfigured` (or where a missing config is genuinely fatal).
 */
export function getSupabaseConfig(): { url: string; anonKey: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.",
    );
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

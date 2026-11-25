/**
 * Build a Workspace password-recovery URL that does not depend on Supabase
 * Auth Site URL / redirect allow-list.
 *
 * Dashboard/generateLink recovery links embed redirect_to=Site URL. When Site
 * URL is still localhost, that link opens ERR_CONNECTION_REFUSED. We send
 * hashed_token to /login/reset so the browser can verifyOtp with the baked
 * NEXT_PUBLIC_SUPABASE_* client config (Production image must include those
 * build-args). /login/reset/complete remains as a server-side fallback route.
 */

export function workspacePasswordRecoveryUrl(input: {
  workspaceOrigin: string;
  hashedToken: string;
}): string {
  const origin = input.workspaceOrigin.replace(/\/$/, "");
  const token = input.hashedToken.trim();
  if (!origin || !token) {
    throw new Error("workspacePasswordRecoveryUrl requires origin and hashedToken");
  }
  const u = new URL(`${origin}/login/reset`);
  u.searchParams.set("token_hash", token);
  u.searchParams.set("type", "recovery");
  return u.toString();
}

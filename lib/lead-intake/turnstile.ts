/**
 * Layered abuse protection, part 2 — Cloudflare Turnstile.
 *
 * Deliberately escalation-only, not default friction: most submissions
 * never see a challenge. Once a caller is close to the rate limit
 * (rate-limit.ts's isNearRateLimit), a valid Turnstile token becomes
 * required rather than optional. Below that threshold, a token is verified
 * if present but never demanded — the widget can render invisibly/passively
 * without blocking anyone.
 *
 * Gracefully inert when unconfigured (no TURNSTILE_SECRET_KEY) — same
 * pattern as every other optional integration in this codebase (Resend,
 * Stripe, Twilio): the feature it protects still works, just without this
 * extra layer, rather than hard-failing.
 */

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstileToken(token: string | null, ipAddress: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ipAddress ? { remoteip: ipAddress } : {}),
      }),
    });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return data?.success === true;
  } catch {
    // A verification-service outage shouldn't be indistinguishable from a
    // real bot — fail open here; rate limiting and the honeypot still apply.
    return true;
  }
}

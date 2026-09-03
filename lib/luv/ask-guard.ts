/**
 * Abuse/cost protection for couple-facing Luv Ask.
 *
 * In-memory sliding window — same idea as lead-intake rate limiting
 * (cheap, no new infrastructure) without using that table or Turnstile.
 */

export const LUV_ASK_MAX_QUESTION_CHARS = 500;
export const LUV_ASK_WINDOW_MS = 10 * 60 * 1000;
export const LUV_ASK_MAX_PER_TOKEN = 12;
export const LUV_ASK_MAX_PER_IP = 20;

const hits = new Map<string, number[]>();

export function isLuvAskQuestionTooLong(question: string): boolean {
  return question.trim().length > LUV_ASK_MAX_QUESTION_CHARS;
}

export function luvAskClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

export type LuvAskRateLimitResult = { allowed: true } | { allowed: false };

function recentHits(key: string, now: number): number[] {
  const cutoff = now - LUV_ASK_WINDOW_MS;
  return (hits.get(key) ?? []).filter((t) => t > cutoff);
}

export function checkLuvAskRateLimit(params: {
  token: string;
  ip: string | null;
  now?: number;
}): LuvAskRateLimitResult {
  const now = params.now ?? Date.now();
  const tokenKey = `token:${params.token}`;
  const tokenHits = recentHits(tokenKey, now);
  if (tokenHits.length >= LUV_ASK_MAX_PER_TOKEN) {
    hits.set(tokenKey, tokenHits);
    return { allowed: false };
  }

  if (params.ip) {
    const ipKey = `ip:${params.ip}`;
    const ipHits = recentHits(ipKey, now);
    if (ipHits.length >= LUV_ASK_MAX_PER_IP) {
      hits.set(ipKey, ipHits);
      return { allowed: false };
    }
    ipHits.push(now);
    hits.set(ipKey, ipHits);
  }

  tokenHits.push(now);
  hits.set(tokenKey, tokenHits);
  return { allowed: true };
}

/** Test-only: clear in-memory buckets. */
export function resetLuvAskRateLimitForTests(): void {
  hits.clear();
}

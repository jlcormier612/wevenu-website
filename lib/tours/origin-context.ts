/**
 * Opaque originating context for a Lead-scoped public tour scheduling link.
 *
 * The public URL must not accept a raw unsigned leadId. Payload is
 * venue-bound HMAC (SHA-256). Query param is `o`, not leadId.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type TourOriginPayload = {
  venueId: string;
  leadId: string;
  exp: number;
};

export function tourOriginSigningSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const secret =
    env.TOUR_ORIGIN_SIGNING_SECRET?.trim() ||
    env.CRON_SECRET?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  return secret.length > 0 ? secret : null;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function signaturesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createTourOriginToken(
  input: { venueId: string; leadId: string; nowMs?: number; ttlMs?: number },
  secret: string,
): string {
  const exp = (input.nowMs ?? Date.now()) + (input.ttlMs ?? DEFAULT_TTL_MS);
  const body = `${TOKEN_VERSION}.${input.venueId}.${input.leadId}.${exp}`;
  return `${body}.${sign(body, secret)}`;
}

export function verifyTourOriginToken(
  raw: string | null | undefined,
  secret: string,
  nowMs = Date.now(),
): TourOriginPayload | null {
  const token = raw?.trim();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [version, venueId, leadId, expRaw, sig] = parts;
  if (version !== TOKEN_VERSION || !venueId || !leadId || !expRaw || !sig) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= nowMs) return null;
  const body = `${version}.${venueId}.${leadId}.${expRaw}`;
  const expected = sign(body, secret);
  if (!signaturesEqual(sig, expected)) return null;
  return { venueId, leadId, exp };
}

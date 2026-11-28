import { createHmac, timingSafeEqual } from "node:crypto";

export const WEDDING_WEBSITE_UNLOCK_COOKIE = "htc_ww_unlock";

type UnlockClaims = {
  siteId: string;
  version: number;
  exp: number;
};

function secret(): string {
  return (
    process.env.SENSITIVE_FIELD_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "local-dev-wedding-website-unlock"
  );
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function mintWeddingWebsiteUnlockToken(input: {
  siteId: string;
  passwordVersion: number;
  ttlSeconds?: number;
}): string {
  const ttl = Math.max(60, Math.min(input.ttlSeconds ?? 60 * 60 * 12, 60 * 60 * 24));
  const claims: UnlockClaims = {
    siteId: input.siteId,
    version: input.passwordVersion,
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const payloadB64 = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyWeddingWebsiteUnlockToken(
  token: string | undefined | null,
  expected: { siteId: string; passwordVersion: number },
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!token || !token.includes(".")) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  const expectedSig = sign(payloadB64);
  try {
    if (
      expectedSig.length !== sig.length ||
      !timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig))
    ) {
      return false;
    }
  } catch {
    return false;
  }
  try {
    const claims = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as UnlockClaims;
    if (claims.siteId !== expected.siteId) return false;
    if (claims.version !== expected.passwordVersion) return false;
    if (claims.exp < nowSeconds) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Stage 1F — signed short-lived support-access tokens.
 * Shared by Workspace CRM (issuer) and venue/client/vendor apps (consumer).
 * No permanent viewing history table — claims expire and are not page-logged.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type SupportPortal = "venue" | "client" | "vendor";
export type SupportMode = "read" | "assist";

export type SupportAccessClaims = {
  v: 1;
  portal: SupportPortal;
  mode: SupportMode;
  venueId: string | null;
  clientId: string | null;
  vendorId: string | null;
  relationshipId: string | null;
  actorUserId: string;
  actorEmail: string;
  iat: number;
  exp: number;
  jti: string;
};

function secret(): string {
  return (
    process.env.HTC_SUPPORT_TICKET_SECRET?.trim() ||
    process.env.WORKSPACE_BOOTSTRAP_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "local-dev-support-ticket-secret"
  );
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function mintSupportAccessToken(
  input: Omit<SupportAccessClaims, "v" | "iat" | "exp" | "jti"> & {
    ttlSeconds?: number;
  },
): { token: string; claims: SupportAccessClaims } {
  const ttl = Math.max(30, Math.min(input.ttlSeconds ?? 90, 300));
  const now = Math.floor(Date.now() / 1000);
  const claims: SupportAccessClaims = {
    v: 1,
    portal: input.portal,
    mode: input.mode,
    venueId: input.venueId,
    clientId: input.clientId,
    vendorId: input.vendorId,
    relationshipId: input.relationshipId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail.trim().toLowerCase(),
    iat: now,
    exp: now + ttl,
    jti: b64url(Buffer.from(`${now}-${Math.random()}`)).slice(0, 16),
  };
  const payloadB64 = b64url(JSON.stringify(claims));
  const sig = signPayload(payloadB64);
  return { token: `${payloadB64}.${sig}`, claims };
}

export function verifySupportAccessToken(
  token: string,
): { ok: true; claims: SupportAccessClaims } | { ok: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "malformed" };
  const [payloadB64, sig] = parts as [string, string];
  const expected = signPayload(payloadB64);
  try {
    if (
      !timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) &&
      expected !== sig
    ) {
      // base64url strings may differ in length — fall back to equality
      if (expected !== sig) return { ok: false, error: "bad_signature" };
    }
  } catch {
    if (expected !== sig) return { ok: false, error: "bad_signature" };
  }
  let claims: SupportAccessClaims;
  try {
    claims = JSON.parse(fromB64url(payloadB64).toString("utf8")) as SupportAccessClaims;
  } catch {
    return { ok: false, error: "bad_payload" };
  }
  if (claims.v !== 1) return { ok: false, error: "unsupported_version" };
  if (claims.exp * 1000 <= Date.now()) return { ok: false, error: "expired" };
  if (!claims.actorUserId || !claims.actorEmail) {
    return { ok: false, error: "missing_actor" };
  }
  return { ok: true, claims };
}

export function productAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
    process.env.PRODUCT_APP_URL?.trim() ||
    "https://app.sandbox.hellotocheers.com"
  ).replace(/\/$/, "");
}

export function workspaceAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WORKSPACE_URL?.trim() ||
    process.env.WORKSPACE_URL?.trim() ||
    "https://workspace.sandbox.hellotocheers.com"
  ).replace(/\/$/, "");
}

/**
 * Encrypt sensitive texting-registration fields at rest.
 *
 * Repo pattern: provider credentials live in AWS Secrets Manager, not Postgres.
 * EIN / tax IDs are HTC-owned compliance data that must persist for editing and
 * future provider submit — AES-256-GCM ciphertext in Postgres is the secure
 * approach here (never plaintext in client DTOs or logs).
 *
 * Key: SENSITIVE_FIELD_ENCRYPTION_KEY — 64 hex chars (32 bytes).
 * NODE_ENV=test uses a fixed test key when unset.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function resolveKey(): Buffer {
  const raw = process.env.SENSITIVE_FIELD_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error(
        "SENSITIVE_FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes).",
      );
    }
    return Buffer.from(raw, "hex");
  }
  if (process.env.NODE_ENV === "test") {
    return Buffer.from(TEST_KEY_HEX, "hex");
  }
  throw new Error(
    "SENSITIVE_FIELD_ENCRYPTION_KEY is not configured — cannot store sensitive registration numbers.",
  );
}

/** v1:<iv_b64>:<tag_b64>:<ciphertext_b64> */
export function encryptSensitiveField(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSensitiveField(payload: string): string {
  const key = resolveKey();
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unrecognized sensitive field ciphertext format.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Digits only; US EIN displayed as last 4. */
export function registrationNumberLast4(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return digits;
  return digits.slice(-4);
}

export function normalizeRegistrationNumber(raw: string): string {
  return raw.replace(/\D/g, "").trim();
}

/** Never log or return full registration numbers from this helper. */
export function maskRegistrationNumberLast4(last4: string | null | undefined): string {
  if (!last4) return "On file";
  return `••••${last4}`;
}

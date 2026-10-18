/**
 * QuickBooks OAuth tokens at rest.
 *
 * Same AES-256-GCM utility as texting registration numbers
 * (`lib/texting-registration/sensitive-field.ts`), stored in the existing
 * `access_token` / `refresh_token` text columns. No migration: a row written
 * before this change is still plaintext and stays readable. The next
 * successful connect or refresh seals it. A failed decrypt never clears
 * those columns and is not treated as an expired refresh token.
 *
 * Rollback: an older build would send `v1:` ciphertext to Intuit and the
 * call would fail. Recovery is reconnect, which overwrites both columns.
 * Do not blank the columns to "fix" a decrypt error.
 */
import {
  decryptSensitiveField,
  encryptSensitiveField,
} from "@/lib/texting-registration/sensitive-field";

export class QuickBooksTokenDecryptError extends Error {
  readonly code = "quickbooks_token_decrypt_failed";

  constructor() {
    super(
      "QuickBooks credentials could not be read. The stored connection was left unchanged. Reconnect QuickBooks if this persists.",
    );
    this.name = "QuickBooksTokenDecryptError";
  }
}

export function isSealedQuickBooksToken(stored: string): boolean {
  return stored.startsWith("v1:");
}

/** Seal a plaintext token. Refuses an empty value so a refresh cannot wipe a credential. */
export function sealQuickBooksToken(plaintext: string): string {
  const value = plaintext.trim();
  if (!value) {
    throw new Error("Refusing to store an empty QuickBooks token.");
  }
  const sealed = encryptSensitiveField(value);
  if (sealed === value || !isSealedQuickBooksToken(sealed)) {
    throw new Error("QuickBooks token sealing failed.");
  }
  return sealed;
}

/**
 * Open a stored token.
 * `v1:` is ciphertext. Anything else is a legacy plaintext row.
 * Decrypt failure throws and does not return a substitute value.
 */
export function openQuickBooksToken(stored: string): string {
  if (!stored.trim()) {
    throw new QuickBooksTokenDecryptError();
  }
  if (!isSealedQuickBooksToken(stored)) {
    return stored;
  }
  try {
    const plain = decryptSensitiveField(stored);
    if (!plain.trim()) throw new QuickBooksTokenDecryptError();
    return plain;
  } catch (err) {
    if (err instanceof QuickBooksTokenDecryptError) throw err;
    throw new QuickBooksTokenDecryptError();
  }
}

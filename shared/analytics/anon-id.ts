/**
 * First-party opaque anonymous ID — cryptographically random, never from PII.
 * Created only when analytics consent is ON (caller responsibility).
 * Never send to GA4 when consent is OFF.
 */
import { anonIdStorageKey } from "./constants";

export type AnonIdScope = `marketing` | `venue:${string}`;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function newOpaqueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Extremely old environments — still non-PII random hex.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function readOpaqueAnonId(scope: AnonIdScope): string | null {
  if (!canUseStorage()) return null;
  try {
    const v = window.localStorage.getItem(anonIdStorageKey(scope));
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Returns existing ID or creates one. Call only when analytics consent is ON. */
export function getOrCreateOpaqueAnonId(scope: AnonIdScope): string | null {
  if (!canUseStorage()) return null;
  const existing = readOpaqueAnonId(scope);
  if (existing) return existing;
  const id = newOpaqueId();
  try {
    window.localStorage.setItem(anonIdStorageKey(scope), id);
    return id;
  } catch {
    return null;
  }
}

export function clearOpaqueAnonId(scope: AnonIdScope): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(anonIdStorageKey(scope));
  } catch {
    // ignore
  }
}

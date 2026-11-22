/**
 * In-memory Auth user binding for R1A unit tests (WORKSPACE_AUTH_PROVIDER=memory).
 * Not used in Sandbox/Production.
 */

const globalForAuth = globalThis as unknown as {
  __htcMemoryAuthUserId?: string | null;
};

export function setMemoryAuthUserId(userId: string | null) {
  globalForAuth.__htcMemoryAuthUserId = userId;
}

export function getMemoryAuthUserId(): string | null {
  return globalForAuth.__htcMemoryAuthUserId ?? null;
}

export function clearMemoryAuth() {
  globalForAuth.__htcMemoryAuthUserId = null;
}

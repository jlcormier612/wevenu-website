/**
 * Client deploy/version-skew recovery.
 *
 * Rolling ECS deploys can leave an open tab on build A while RSC / chunks /
 * Server Actions come from build B. Next's DefaultGlobalError then shows
 * "This page couldn't load". That is not an acceptable customer-facing state
 * for normal navigation — recover with a single hard reload instead.
 */

export const SKEW_RELOAD_STORAGE_KEY = "htc.deploy-skew-reload";

/** How long a prior auto-reload blocks another for the same path (ms). */
export const SKEW_RELOAD_COOLDOWN_MS = 15_000;

const SKEW_MESSAGE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to find Server Action|Server Action .* was not found|was not found on the server|older or newer deployment|router state header was sent but could not be parsed|Unexpected token '<'/i;

export type SkewReloadRecord = {
  path: string;
  at: number;
};

export function getErrorDigest(error: unknown): string {
  if (typeof error !== "object" || error === null || !("digest" in error)) return "";
  return String((error as { digest?: unknown }).digest ?? "");
}

export function isLikelyDeploySkewError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") return SKEW_MESSAGE.test(error);

  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const digest = getErrorDigest(error);

  if (name === "ChunkLoadError") return true;
  if (SKEW_MESSAGE.test(name) || SKEW_MESSAGE.test(message)) return true;
  // Next sometimes surfaces action-id skew only via digest text.
  if (SKEW_MESSAGE.test(digest)) return true;
  return false;
}

/**
 * Whether a fatal error boundary should attempt one hard reload.
 * Covers known skew signatures plus digest-less client fatals (Flight decode
 * TypeErrors during rollout often lack a ChunkLoadError name).
 */
export function shouldAutoRecoverFromFatal(error: unknown): boolean {
  if (isLikelyDeploySkewError(error)) return true;
  return getErrorDigest(error) === "";
}

/**
 * Returns true when a hard reload should run for this path.
 * Callers must invoke {@link markSkewReloadAttempted} immediately before reload.
 */
export function shouldAttemptSkewReload(
  path: string,
  now = Date.now(),
  read: () => string | null = defaultRead,
): boolean {
  const raw = read();
  if (!raw) return true;
  let prior: SkewReloadRecord | null = null;
  try {
    prior = JSON.parse(raw) as SkewReloadRecord;
  } catch {
    return true;
  }
  if (!prior || typeof prior.path !== "string" || typeof prior.at !== "number") {
    return true;
  }
  if (prior.path !== path) return true;
  return now - prior.at >= SKEW_RELOAD_COOLDOWN_MS;
}

export function markSkewReloadAttempted(
  path: string,
  now = Date.now(),
  write: (value: string) => void = defaultWrite,
): void {
  const record: SkewReloadRecord = { path, at: now };
  write(JSON.stringify(record));
}

export function clearSkewReloadGuard(remove: () => void = defaultRemove): void {
  remove();
}

function defaultRead(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(SKEW_RELOAD_STORAGE_KEY);
  } catch {
    return null;
  }
}

function defaultWrite(value: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(SKEW_RELOAD_STORAGE_KEY, value);
  } catch {
    // private mode / quota — skip persistence; reload still helps once
  }
}

function defaultRemove(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(SKEW_RELOAD_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Consume the one-shot reload guard for `path`.
 * Returns true when the caller should hard-reload now.
 */
export function consumeSkewReload(
  path: string,
  now = Date.now(),
  read: () => string | null = defaultRead,
  write: (value: string) => void = defaultWrite,
): boolean {
  if (!shouldAttemptSkewReload(path, now, read)) return false;
  markSkewReloadAttempted(path, now, write);
  return true;
}

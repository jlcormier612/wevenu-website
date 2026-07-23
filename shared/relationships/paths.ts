import { existsSync } from "fs";
import path from "path";

/**
 * Resolve the shared relationships data directory.
 *
 * Env: RELATIONSHIPS_DATA_PATH (absolute or relative to cwd)
 * Default: <repo>/shared/relationships/.data
 *
 * Works when cwd is marketing/, workspace/, or the repo root.
 *
 * Important: prefer the package directory that contains `types.ts`.
 * Orphan mirrors under marketing/shared or workspace/shared (created if an
 * earlier resolver wrote there) must NOT win — that splits marketing writes
 * from the workspace UI.
 */
export function getRelationshipsDataDir(): string {
  const fromEnv = process.env.RELATIONSHIPS_DATA_PATH?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "shared", "relationships", ".data"),
    path.join(cwd, "..", "shared", "relationships", ".data"),
    path.join(cwd, "..", "..", "shared", "relationships", ".data"),
  ];

  // Prefer the real package (has source), not an app-local .data-only mirror.
  for (const candidate of candidates) {
    const moduleDir = path.dirname(candidate);
    if (existsSync(path.join(moduleDir, "types.ts"))) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    const moduleDir = path.dirname(candidate);
    if (existsSync(moduleDir)) {
      return candidate;
    }
  }

  // Fallback: assume cwd is marketing or workspace sibling of shared/
  return path.join(cwd, "..", "shared", "relationships", ".data");
}

export const STORE_FILES = {
  relationships: "relationships.jsonl",
  timelineEvents: "timeline-events.jsonl",
  communications: "communications.jsonl",
  walkthroughs: "walkthroughs.jsonl",
  subscriptions: "subscriptions.jsonl",
  notifications: "notifications.jsonl",
  tasks: "tasks.jsonl",
} as const;

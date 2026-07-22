import { existsSync } from "fs";
import path from "path";

/**
 * Resolve the shared relationships data directory.
 *
 * Env: RELATIONSHIPS_DATA_PATH (absolute or relative to cwd)
 * Default: <repo>/shared/relationships/.data
 *
 * Works when cwd is marketing/, workspace/, or the repo root.
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

  for (const candidate of candidates) {
    const moduleDir = path.dirname(candidate);
    if (existsSync(moduleDir) || existsSync(path.join(moduleDir, "types.ts"))) {
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

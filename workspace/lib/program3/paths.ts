import { existsSync } from "fs";
import path from "path";

/**
 * Workspace Program 3 data directory.
 * Default: <workspace>/.data
 * Override: WORKSPACE_DATA_PATH
 */
export function getWorkspaceDataDir(): string {
  const fromEnv = process.env.WORKSPACE_DATA_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".data"),
    path.join(cwd, "workspace", ".data"),
  ];
  for (const candidate of candidates) {
    const parent = path.dirname(candidate);
    if (existsSync(path.join(parent, "package.json"))) {
      return candidate;
    }
  }
  return path.join(cwd, ".data");
}

export const PROGRAM3_FILES = {
  workflows: "workflows.jsonl",
  workflowRuns: "workflow-runs.jsonl",
  templates: "templates.jsonl",
  sequences: "sequences.jsonl",
  sequenceEnrollments: "sequence-enrollments.jsonl",
  categories: "categories.jsonl",
  branding: "branding.json",
  relationshipPatches: "relationship-patches.jsonl",
  localTimeline: "local-timeline.jsonl",
  localCommunications: "local-communications.jsonl",
  localTasks: "local-tasks.jsonl",
  seedMarker: "program3-seeded.json",
} as const;

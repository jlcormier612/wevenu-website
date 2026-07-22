import { appendFile, mkdir } from "fs/promises";
import path from "path";

import { filePath, readJsonlSync } from "@/lib/program3/jsonl";
import { getWorkspaceDataDir } from "@/lib/program3/paths";

import type { LuvDismissal } from "./types";

const DISMISSALS_FILE = "luv-dismissals.jsonl";

function dismissalsPath(): string {
  return filePath(DISMISSALS_FILE);
}

export function getDismissedInsightIdsSync(actorId?: string): Set<string> {
  const rows = readJsonlSync<LuvDismissal>(dismissalsPath());
  const ids = new Set<string>();
  for (const row of rows) {
    if (actorId && row.actorId !== actorId) continue;
    ids.add(row.insightId);
  }
  return ids;
}

export async function dismissInsight(input: {
  insightId: string;
  relationshipId?: string | null;
  actorId: string;
}): Promise<void> {
  const dir = getWorkspaceDataDir();
  await mkdir(dir, { recursive: true });
  const row: LuvDismissal = {
    insightId: input.insightId,
    relationshipId: input.relationshipId ?? null,
    actorId: input.actorId,
    dismissedAt: new Date().toISOString(),
  };
  await appendFile(path.join(dir, DISMISSALS_FILE), `${JSON.stringify(row)}\n`, "utf8");
}

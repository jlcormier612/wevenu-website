/**
 * Venue Planning task list — responsibility grouping from ownerType metadata.
 * Couple portal must continue to filter separately; this is venue-side only.
 */

import type { TaskOwner } from "@/lib/playbooks/types";

export type TaskResponsibility = "client" | "venue" | "vendor";

export const TASK_RESPONSIBILITY_LABEL: Record<TaskResponsibility, string> = {
  client: "Client",
  venue: "Venue",
  vendor: "Vendor",
};

/** Source of truth: EventTask.ownerType — never title heuristics. */
export function responsibilityForOwnerType(ownerType: TaskOwner | string): TaskResponsibility {
  if (ownerType === "couple") return "client";
  if (ownerType === "vendor") return "vendor";
  // coordinator | team — venue staff. Unknown values stay venue (safe default;
  // never classified as client / never leak to couple portal via this helper).
  if (ownerType === "coordinator" || ownerType === "team") return "venue";
  return "venue";
}

export function groupTasksByResponsibility<T extends { ownerType: TaskOwner | string; id: string }>(
  tasks: readonly T[],
): { client: T[]; venue: T[]; vendor: T[]; omitted: never[]; duplicates: never[] } {
  const client: T[] = [];
  const venue: T[] = [];
  const vendor: T[] = [];
  const seen = new Set<string>();

  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    const group = responsibilityForOwnerType(task.ownerType);
    if (group === "client") client.push(task);
    else if (group === "vendor") vendor.push(task);
    else venue.push(task);
  }

  return { client, venue, vendor, omitted: [], duplicates: [] };
}

/** Every input id appears exactly once across the three groups. */
export function responsibilityGroupsCoverAll<T extends { id: string }>(
  tasks: readonly T[],
  groups: { client: T[]; venue: T[]; vendor: T[] },
): boolean {
  const out = [...groups.client, ...groups.venue, ...groups.vendor].map((t) => t.id).sort();
  const input = [...new Set(tasks.map((t) => t.id))].sort();
  return out.length === input.length && out.every((id, i) => id === input[i]);
}

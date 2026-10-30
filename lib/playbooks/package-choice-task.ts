/**
 * R3 — an approved package never appears as an open choice.
 *
 * Client checklists applied before the pre-booking "Booking" milestone was
 * dropped (20261408400000) still carry a manual "Choose your package" task.
 * The accepted commercial selection is the authority for the package
 * decision: when one exists for the relationship, that task reads as done on
 * both the couple and venue lists. Presentation only — the event_tasks row is
 * never written.
 */

export const PACKAGE_APPROVED_LABEL = "Package approved";

export function isPackageChoiceTask(task: { title: string }): boolean {
  return task.title.trim().toLowerCase() === "choose your package";
}

type DerivableTask = {
  title: string;
  status: string;
  packageApproved?: boolean;
};

export function applyAcceptedPackageToTasks<T extends DerivableTask>(
  tasks: T[],
  packageAccepted: boolean,
): T[] {
  if (!packageAccepted) return tasks;
  return tasks.map((t) => {
    if (!isPackageChoiceTask(t) || t.status === "waived") return t;
    const derived = { ...t, status: "complete", packageApproved: true } as T;
    if ("canComplete" in derived) Object.assign(derived, { canComplete: false });
    if ("canUndo" in derived) Object.assign(derived, { canUndo: false });
    return derived;
  });
}

type SelectionReader = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

/** True when the relationship has an accepted commercial selection at this venue. */
export async function hasAcceptedPackage(
  client: SelectionReader,
  venueId: string,
  clientId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("commercial_selections")
    .select("id")
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .eq("status", "accepted")
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

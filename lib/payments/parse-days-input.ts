/** Parse a Days field without turning a transient empty string into 0 / on_event. */
export function parseDaysInput(raw: string): { editing: true; days: number | null } {
  const trimmed = raw.trim();
  if (trimmed === "") return { editing: true, days: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { editing: true, days: null };
  return { editing: true, days: Math.max(0, n) };
}

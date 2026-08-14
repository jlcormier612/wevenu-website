/**
 * The one shared CSV serializer. Extracted from a private, unexported
 * helper of the same shape already living in
 * app/(app)/calendar/print/print-toolbar.tsx (Work Package D7C research
 * pass found it was about to become a third copy) — plain header row +
 * escaped value rows, no library needed for something this small.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  return lines.join("\n");
}

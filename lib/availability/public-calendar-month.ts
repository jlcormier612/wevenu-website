/**
 * Layout for the public availability month. Availability itself is decided
 * by public._is_event_date_available; this only places those dates on a grid.
 */

export type PublicMonthCell = {
  iso: string;
  inMonth: boolean;
  available: boolean;
  /** Existing inquiry form. Null for other months, unavailable days, and past days. */
  inquireHref: string | null;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(last)}`,
  };
}

export function publicMonthCells(
  year: number,
  month: number,
  available: ReadonlySet<string>,
  today: string,
  token: string,
): PublicMonthCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: PublicMonthCell[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - (firstWeekday - i)));
    const iso = d.toISOString().slice(0, 10);
    cells.push({ iso, inMonth: false, available: false, inquireHref: null });
  }

  for (let day = 1; day <= days; day++) {
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    const isAvailable = available.has(iso);
    const inquireHref = isAvailable && iso >= today
      ? `/form/${encodeURIComponent(token)}?date=${iso}`
      : null;
    cells.push({ iso, inMonth: true, available: isAvailable, inquireHref });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]?.iso ?? `${year}-${pad(month)}-${pad(days)}`;
    const d = new Date(`${last}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cells.push({
      iso: d.toISOString().slice(0, 10),
      inMonth: false,
      available: false,
      inquireHref: null,
    });
  }

  return cells;
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { monthBounds, publicMonthCells } from "@/lib/availability/public-calendar-month";

const sql = readFileSync(
  resolve("supabase/migrations/20261403000000_public_availability_calendar.sql"),
  "utf8",
);

describe("public availability authority", () => {
  const body = sql.slice(sql.indexOf("as $$"));

  it("uses _is_event_date_available and the venue embed key, not a second model", () => {
    assert.match(body, /_is_event_date_available\(v_venue\.id, v_cur\)/);
    assert.match(body, /where embed_key = p_embed_key/);
    assert.doesNotMatch(body, /from public\.(date_holds|tour_appointments|clients|leads|events)/);
    assert.doesNotMatch(body, /insert into|booked_at/i);
  });

  it("returns branding and dates only", () => {
    assert.match(body, /'name', v_venue\.name/);
    assert.match(body, /'timezone'/);
    assert.match(body, /'dates', to_jsonb\(v_dates\)/);
    assert.doesNotMatch(body, /first_name|v_venue\.email|guest_count|estimated_revenue/);
  });

  it("is executable by anonymous visitors and rejects a bad key", () => {
    assert.match(sql, /grant execute on function public\.get_public_availability_calendar\(text, date, date\) to anon, authenticated/);
    assert.match(sql, /invalid_key/);
  });
});

describe("public month grid", () => {
  it("marks only the returned dates available and does not invent a reason", () => {
    const cells = publicMonthCells(2026, 9, new Set(["2026-09-02"]), "2026-09-01", "venue-key");
    const second = cells.find((c) => c.iso === "2026-09-02" && c.inMonth);
    const third = cells.find((c) => c.iso === "2026-09-03" && c.inMonth);
    assert.equal(second?.available, true);
    assert.equal(third?.available, false);
    assert.equal(third?.inquireHref, null);
  });

  it("links an available future date into the existing inquiry form", () => {
    const cells = publicMonthCells(2026, 9, new Set(["2026-09-20"]), "2026-09-20", "abc key");
    const day = cells.find((c) => c.iso === "2026-09-20");
    assert.equal(day?.inquireHref, "/form/abc%20key?date=2026-09-20");
  });

  it("does not offer inquiry for an available date in the past", () => {
    const cells = publicMonthCells(2026, 9, new Set(["2026-09-01"]), "2026-09-20", "key");
    assert.equal(cells.find((c) => c.iso === "2026-09-01")?.inquireHref, null);
  });

  it("crosses the year boundary without dropping December or January", () => {
    assert.deepEqual(monthBounds(2026, 12), { start: "2026-12-01", end: "2026-12-31" });
    assert.deepEqual(monthBounds(2027, 1), { start: "2027-01-01", end: "2027-01-31" });
    const december = publicMonthCells(2026, 12, new Set(["2026-12-31"]), "2026-12-01", "key");
    const january = publicMonthCells(2027, 1, new Set(["2027-01-01"]), "2026-12-01", "key");
    assert.equal(december.some((c) => c.iso === "2026-12-31" && c.inMonth && c.available), true);
    assert.equal(january.some((c) => c.iso === "2027-01-01" && c.inMonth && c.available), true);
    assert.equal(january.find((c) => c.iso === "2027-01-01")?.inquireHref, "/form/key?date=2027-01-01");
  });

  it("a completely open month links every day on or after today", () => {
    const open = new Set<string>();
    for (let day = 1; day <= 30; day++) open.add(`2026-09-${String(day).padStart(2, "0")}`);
    const cells = publicMonthCells(2026, 9, open, "2026-09-01", "key").filter((c) => c.inMonth);
    assert.equal(cells.length, 30);
    assert.equal(cells.every((c) => c.available && c.inquireHref), true);
  });

  it("a fully unavailable month has no inquiry links", () => {
    const cells = publicMonthCells(2026, 9, new Set(), "2026-09-01", "key").filter((c) => c.inMonth);
    assert.equal(cells.every((c) => !c.available && c.inquireHref === null), true);
  });
});

describe("authoritative date rules", () => {
  const migration = readFileSync(
    resolve("supabase/migrations/20261321000000_calendar_block_recurrence_coverage.sql"),
    "utf8",
  );
  const fn = migration.slice(
    migration.indexOf("function public._is_event_date_available"),
    migration.indexOf("function public.events_enforce_availability"),
  );

  it("closes a date for a covering block or full-day event occupancy, not for holds or tours", () => {
    assert.match(fn, /covering_calendar_block_title/);
    assert.match(fn, /evaluate_event_availability/);
    assert.doesNotMatch(fn, /date_holds|tour_appointments/);
  });
});
describe("share control and public page", () => {
  it("copies a stable embed-key URL and previews the public page", () => {
    const calendar = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
    const share = readFileSync(resolve("components/calendar/share-availability.tsx"), "utf8");
    const page = readFileSync(resolve("app/availability/[token]/page.tsx"), "utf8");
    const view = readFileSync(resolve("components/availability/public-availability-view.tsx"), "utf8");
    const month = readFileSync(resolve("lib/availability/public-calendar-month.ts"), "utf8");
    assert.match(calendar, /\/availability\/\$\{venue\.embedKey\}/);
    assert.match(share, /Copy link/);
    assert.match(share, /Preview/);
    assert.match(share, /Availability link copied/);
    assert.match(share, /Share your availability/);
    assert.match(share, /href=\{url\}/);
    assert.match(share, /writeText\(url\)/);
    assert.doesNotMatch(share, /Send calendar|Calendar sent|Share sent/);
    assert.doesNotMatch(calendar, /rotateEmbed|regenerateEmbed|crypto\.randomUUID/);
    assert.match(page, /PublicAvailabilityView/);
    assert.match(view, /Available/);
    assert.match(view, /Not available/);
    assert.match(month, /\/form\//);
    assert.doesNotMatch(view, /Wedding Day|Everything|Sales|Planning|Operations|Hold|Blocked Time|Appointment|Tour/);
    assert.doesNotMatch(readFileSync(resolve("lib/availability/public-calendar.ts"), "utf8"), /from\("leads"\)|from\("events"\)|from\("clients"\)/);
  });
});

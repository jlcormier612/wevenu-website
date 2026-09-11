/**
 * Key Dates product retirement — protect against reintroduction of the
 * freeform client_key_dates product surface.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("Key Dates product retirement", () => {
  it("removes venue event Overview Key Dates card", () => {
    const src = read("components/events/event-detail.tsx");
    assert.doesNotMatch(src, /Key Dates/);
    assert.doesNotMatch(src, /KeyDatesSection/);
    assert.doesNotMatch(src, /keyDates/);
  });

  it("removes portal Next key date card and API route", () => {
    const portal = read("components/portal/portal-shell.tsx");
    assert.doesNotMatch(portal, /Next key date/i);
    assert.doesNotMatch(portal, /KeyDatesCard/);
    assert.doesNotMatch(portal, /\/api\/portal\/key-dates/);
    assert.throws(() => read("app/api/portal/key-dates/route.ts"));
  });

  it("does not query client_key_dates from Dashboard", () => {
    const dash = read("lib/dashboard/service.ts");
    assert.doesNotMatch(dash, /client_key_dates/);
    assert.doesNotMatch(dash, /upcomingKeyDates/);
    const engine = read("lib/dashboard-system/decision-engine.ts");
    assert.doesNotMatch(engine, /upcomingKeyDates/);
    assert.doesNotMatch(engine, /up-keydate/);
  });

  it("does not treat Key Dates as a Calendar concept", () => {
    const types = read("lib/calendar/types.ts");
    assert.doesNotMatch(types, /key_date/);
    const meta = read("components/calendar/calendar-shared.tsx");
    assert.doesNotMatch(meta, /Key Date/);
    assert.doesNotMatch(meta, /key_date/);
    const css = read("app/globals.css");
    assert.doesNotMatch(css, /--cal-key-date/);
  });

  it("does not produce Luv Key Date suggestions", () => {
    const luv = read("lib/portal/luv-suggestions.ts");
    assert.doesNotMatch(luv, /soonKeyDate/);
    assert.doesNotMatch(luv, /"key_date"/);
  });

  it("blocks Migration Center from creating new Key Dates", () => {
    const ui = read("components/settings/migration-center.tsx");
    // Still labeled for historical records…
    assert.match(ui, /key_date/);
    // …but not in the create/commit picker list.
    assert.doesNotMatch(
      ui,
      /COMMITTABLE_ENTITIES[\s\S]*?"key_date"/,
    );
    const svc = read("lib/migration/service.ts");
    assert.match(svc, /Key Dates have been retired/);
    assert.doesNotMatch(svc, /insertKeyDate/);
  });

  it("preserves historical migration vocabulary", () => {
    const types = read("lib/migration/types.ts");
    assert.match(types, /\| "key_date"/);
  });

  it("keeps Client Info rehearsal_date (not Key Dates)", () => {
    const form = read("components/clients/client-form.tsx");
    assert.match(form, /Rehearsal date/);
    assert.match(form, /rehearsalDate/);
  });

  it("does not leave live insert/delete Key Date product APIs", () => {
    const actions = read("app/(app)/clients/[id]/actions.ts");
    assert.doesNotMatch(actions, /addKeyDate|deleteKeyDate/);
    const repo = read("lib/clients/repository.ts");
    assert.doesNotMatch(repo, /insertKeyDate|deleteKeyDate|client_key_dates/);
  });

  it("ships a schema retirement migration that drops table + portal RPC", () => {
    const mig = read(
      "supabase/migrations/20261368000000_retire_client_key_dates.sql",
    );
    assert.match(mig, /drop function if exists public\.get_portal_key_dates/);
    assert.match(mig, /drop table if exists public\.client_key_dates/);
    assert.doesNotMatch(mig, /drop table.*rehearsal/i);
    assert.doesNotMatch(mig, /drop (table|policy).*client_activities/i);
  });

  it("cutover fixture no longer queries the dropped client_key_dates table", () => {
    const sql = read("lib/migration/cutover-e2e.db.sql");
    assert.doesNotMatch(sql, /from public\.client_key_dates/);
    assert.match(sql, /v_key_dates := 0/);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { applyDefaultPlaybooksForConfirmedBookings } from "@/lib/automation/system-guarantees";

describe("Phase 2 planning apply seams", () => {
  it("preview grouping reflects actual template task titles and timing fields", () => {
    const preview = readFileSync(resolve("lib/playbooks/apply-preview.ts"), "utf8");
    assert.match(preview, /taskTitles/);
    assert.match(preview, /daysOffset/);
    assert.match(preview, /reminderBeforeDays/);
    const sheet = readFileSync(resolve("components/playbooks/playbook-apply-preview-sheet.tsx"), "utf8");
    assert.match(sheet, /formatShortDaysOffset/);
    assert.match(sheet, /formatTemplateReminder/);
  });

  it("Apply uses applyPlaybookToEvent and does not call release", () => {
    const panel = readFileSync(resolve("components/clients/prepare-planning-panel.tsx"), "utf8");
    assert.match(panel, /applyPlaybookAction/);
    assert.match(panel, /PlaybookApplyPreviewSheet/);
    assert.match(panel, /recommendPlanningTemplate/);
    assert.doesNotMatch(panel, /releasePlaybookAction/);
    assert.doesNotMatch(panel, /Standard Wedding/);
  });

  it("Client Planning apply remains Draft until Release; Venue Planning is active on apply", () => {
    const src = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");
    const fnStart = src.indexOf("export async function applyPlaybookToEvent");
    const fnEnd = src.indexOf("export type ReleasePlaybookResult", fnStart);
    const fn = src.slice(fnStart, fnEnd);
    assert.match(fn, /event_playbook_applications/);
    assert.match(fn, /event_tasks/);
    assert.match(fn, /released_at: template\.kind === "venue" \? new Date\(\)\.toISOString\(\) : null/);
    assert.match(fn, /if \(template\.kind !== "client"\)/);
    assert.match(fn, /createRemindersForTask/);
    assert.match(fn, /23505/);
    assert.match(fn, /already_applied/);
  });

  it("a second apply of the same kind is rejected by the existing application guard", () => {
    const src = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");
    const fnStart = src.indexOf("export async function applyPlaybookToEvent");
    const fn = src.slice(fnStart, src.indexOf("export type ReleasePlaybookResult", fnStart));
    assert.match(fn, /return \{ ok: false, reason: "already_applied" \}/);
    const service = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
    assert.match(service, /already has a \$\{kindLabel\} checklist applied/);
  });

  it("Event Confirmed no longer silently applies default playbooks", async () => {
    const result = await applyDefaultPlaybooksForConfirmedBookings();
    assert.deepEqual(result, { applied: 0, skipped: 0, failed: 0 });

    const guarantees = readFileSync(resolve("lib/automation/system-guarantees.ts"), "utf8");
    assert.doesNotMatch(guarantees, /applyPlaybookToEvent/);
    assert.doesNotMatch(guarantees, /from\("playbook_templates"\)/);
    assert.doesNotMatch(guarantees, /from\("platform_events"\)/);

    const engine = readFileSync(resolve("lib/automation/engine.ts"), "utf8");
    assert.match(engine, /applyDefaultPlaybooksForConfirmedBookings/);
  });

  it("convertLeadToClient remains a conversion that does not invite or apply planning", () => {
    const src = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function convertLeadToClient");
    const fnEnd = src.indexOf("export async function updateClientInfo", fnStart);
    const fn = src.slice(fnStart, fnEnd);
    assert.doesNotMatch(fn, /inviteClient\(/);
    assert.doesNotMatch(fn, /applyPlaybookToEvent/);
    assert.doesNotMatch(fn, /releasePlaybookApplication/);
    assert.doesNotMatch(fn, /recommendPlanningTemplate/);
  });

  it("wedding terminology on the booked page is unchanged", () => {
    const celebration = readFileSync(resolve("components/clients/booking-celebration.tsx"), "utf8");
    assert.match(celebration, /eventTypeLabel/);
    assert.match(celebration, /PreparePlanningPanel/);
    const title = readFileSync(resolve("lib/playbooks/constants.ts"), "utf8");
    assert.match(title, /WEDDING_PLANNING_TITLE_EVENT_TYPES/);
    assert.match(title, /formatClientPlanningTitle/);
    const preview = readFileSync(resolve("lib/playbooks/apply-preview.ts"), "utf8");
    assert.match(preview, /For your couple/);
  });
});

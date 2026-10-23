/**
 * "Choose your vendors" — submit advances review; does not complete the task.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const migration = read(
  "supabase/migrations/20261422600000_vendor_selection_task_submit_not_complete.sql",
);
const prior = read(
  "supabase/migrations/20261422500000_submit_vendor_list_exclude_required.sql",
);
const constants = read("lib/playbooks/constants.ts");
const eventList = read("components/playbooks/event-task-list.tsx");
const portal = read("components/portal/vendor-section.tsx");
const pickTest = read("lib/portal/vendor-pick-commitment.test.ts");

describe("vendor selection task lifecycle — submit ≠ complete", () => {
  it("latest submit_vendor_list does not set status=complete on vendor_selected", () => {
    const fn = migration.slice(
      migration.indexOf("create or replace function public.submit_vendor_list"),
      migration.indexOf("$$;", migration.indexOf("create or replace function public.submit_vendor_list")) + 2,
    );
    assert.match(fn, /progress_state = 'in_progress'/);
    assert.match(fn, /when status = 'complete' then 'pending'/);
    assert.doesNotMatch(fn, /status = 'complete',\s*completed_at = now\(\),\s*completed_by = 'system'/);
    assert.doesNotMatch(fn, /set status = 'complete'/);
  });

  it("prior migration still shows the old auto-complete (historical); new migration supersedes", () => {
    assert.match(prior, /auto_complete_trigger = 'vendor_selected'/);
    assert.match(prior, /status = 'complete'/);
    assert.match(migration, /must not auto-complete on couple submit/);
  });

  it("seed copy and trigger label describe venue confirmation finish line", () => {
    assert.match(constants, /submitting an update does not finish this task/);
    assert.match(constants, /couple submits; venue confirms/);
  });

  it("venue task list surfaces needs-review for submitted vendor_selected tasks", () => {
    assert.match(eventList, /Submitted — needs venue review/);
    assert.match(eventList, /mark complete when the vendor team is confirmed/);
  });

  it("portal submit copy does not claim the couple finished the task", () => {
    assert.match(portal, /does not mark that task complete/);
    assert.match(portal, /they will review and confirm your vendor team/);
    assert.doesNotMatch(portal, /and completes\s*\n\s*\* the \"Choose your vendors\" task/);
  });

  it("pick/submit commitment tests remain the gate for selected_at (unchanged path)", () => {
    assert.match(pickTest, /submit_vendor_list/);
    assert.match(pickTest, /Commitment gate to selected_at/);
  });

  it("reopen-on-resubmit and progress sync trigger are defined", () => {
    assert.match(migration, /_sync_vendor_selected_task_progress_on_complete/);
    assert.match(migration, /progress_state := 'complete'/);
    assert.match(migration, /progress_state := 'in_progress'/);
  });
});

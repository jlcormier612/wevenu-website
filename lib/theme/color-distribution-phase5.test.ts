/**
 * Color Distribution Phase 5 — Task Center plate-clear + Availability guidance.
 * Availability refinement: calm intro header + white detail body.
 * EO Example strip remains excluded from calm. Migration calm moved to Phase 6.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Color Distribution Phase 5 — Tasks plate-clear + Availability guidance", () => {
  const tasks = read("components/tasks/task-center.tsx");
  const availability = read("app/(app)/settings/availability/page.tsx");
  const settingsIndex = read("app/(app)/settings/page.tsx");
  const migrationPanel = read("components/settings/migration-guidance-panel.tsx");
  const migrationPage = read("app/(app)/settings/migration/page.tsx");
  const eo = read("app/(app)/library/event-order-templates/page.tsx");
  const banner = read("components/payments/schedule-review-banner.tsx");
  const css = read("app/globals.css");

  it("Task Center plate-clear reassurance uses calm class under exact gate", () => {
    const gate =
      /hasAnyDoTasks && doImmediate === 0 && doUpcomingCount > 0 && !myWorkEmpty && \(\s*<div[\s\S]*?htc-task-center-plate-clear/;
    assert.match(tasks, gate);
    assert.match(tasks, /data-testid="task-center-plate-clear"/);
    assert.match(tasks, /Nothing on your plate today/);
    assert.match(tasks, /Here&apos;s what&apos;s coming up across your events/);
    assert.equal((tasks.match(/htc-task-center-plate-clear/g) ?? []).length, 1);
    assert.match(tasks, /Nothing assigned to you/);
    assert.match(tasks, /No team tasks yet/);
    assert.match(tasks, /border-dashed border-border/);
    assert.match(tasks, /bg-destructive\/5/);
    assert.match(tasks, /bg-sky-50\/50/);
  });

  it("plate-clear and attention banners are mutually exclusive on doImmediate", () => {
    // Plate-clear requires doImmediate === 0; attention requires doImmediate > 0.
    assert.match(
      tasks,
      /hasAnyDoTasks && doImmediate === 0 && doUpcomingCount > 0 && !myWorkEmpty/,
    );
    assert.match(tasks, /\{doImmediate > 0 && \(/);
    assert.match(
      tasks,
      /doImmediate =\s*scopedDo\.overdue\.length \+ scopedDo\.dueToday\.length \+ scopedDo\.dueSoon\.length/,
    );
    // Ordering: plate-clear block appears before attention block in source.
    const plateGate = tasks.indexOf("doImmediate === 0 && doUpcomingCount > 0");
    const attentionGate = tasks.indexOf("{doImmediate > 0 && (");
    assert.ok(plateGate > 0 && attentionGate > plateGate);
  });

  it("Availability guidance splits calm intro from white detail body without rewriting copy", () => {
    assert.match(availability, /htc-availability-settings-guidance-intro/);
    assert.match(availability, /htc-availability-settings-guidance-body/);
    assert.match(availability, /How date availability works/);
    assert.match(availability, /You control when a date is protected/);
    assert.match(availability, /A preferred date from an inquiry does not reserve the date/);
    assert.match(availability, /Public Available \/ Not available/);
    assert.match(availability, /When to block an entire day/);
    assert.match(availability, /Booked events and public availability/);
    assert.match(availability, /Your responsibility/);
    assert.match(availability, /venue-created Holds prevent other bookings/);
    assert.match(availability, /tours can be scheduled when an event is occupying the date/);
    // Intro holds heading + first sentence only; detail body starts at preferred-date para.
    const intro = availability.slice(
      availability.indexOf("htc-availability-settings-guidance-intro"),
      availability.indexOf("htc-availability-settings-guidance-body"),
    );
    assert.match(intro, /How date availability works/);
    assert.match(intro, /You control when a date is protected/);
    assert.doesNotMatch(intro, /preferred date from an inquiry/);
  });

  it("Phase 5 CSS: plate-clear full calm; availability intro calm + body white", () => {
    const plateStart = css.indexOf(".htc-staff .htc-task-center-plate-clear {");
    assert.ok(plateStart > 0);
    const plateBlock = css.slice(plateStart, css.indexOf(".htc-staff .htc-availability-settings-guidance {", plateStart));
    assert.match(plateBlock, /background-color:\s*var\(--htc-calm-blue\)/);
    assert.match(plateBlock, /border-left:\s*3px solid var\(--htc-calm-blue-deep\)/);

    const availStart = css.indexOf(".htc-staff .htc-availability-settings-guidance {");
    assert.ok(availStart > 0);
    const availBlock = css.slice(availStart, css.indexOf(".htc-staff .htc-catalog-section", availStart));
    assert.match(availBlock, /background-color:\s*#ffffff/);
    assert.match(
      availBlock,
      /\.htc-availability-settings-guidance-intro[\s\S]*background-color:\s*var\(--htc-calm-blue\)/,
    );
    assert.match(
      availBlock,
      /\.htc-availability-settings-guidance-body[\s\S]*background-color:\s*#ffffff/,
    );
    assert.doesNotMatch(availBlock, /#eaf1f7|#d5e1eb|#dfe9f1/i);
  });

  it("excludes EO Example and Payment review from Phase 5 calm; Migration owned by Phase 6", () => {
    // Phase 6 owns Migration calm hierarchy — panel must not reuse Phase 5 class names.
    assert.match(migrationPage, /MigrationGuidancePanel/);
    assert.doesNotMatch(migrationPanel, /htc-availability-settings-guidance|htc-task-center-plate-clear/);
    assert.match(migrationPanel, /htc-migration-guidance/);
    assert.match(eo, /LibraryHowItWorks tone="calm"/);
    assert.match(eo, /data-testid="eo-templates-landing-example"/);
    assert.match(eo, /bg-muted\/20/);
    assert.match(
      banner,
      /className="rounded-sm border border-border bg-muted\/30 px-4 py-3 space-y-3"/,
    );
  });

  it("Settings directory cards remain white working surfaces", () => {
    assert.match(settingsIndex, /bg-card p-5/);
    assert.doesNotMatch(settingsIndex, /htc-availability-settings-guidance|htc-task-center-plate-clear/);
  });

  it("preserves Phase 1–4 calm anchors", () => {
    assert.match(css, /\.htc-staff \.htc-library-guidance-calm/);
    assert.match(css, /\.htc-staff \.htc-inbox-no-selection/);
    assert.match(css, /\.htc-staff \.htc-communication-health-guidance/);
    assert.match(css, /section\.htc-automations-help/);
    assert.match(css, /\.htc-staff \.htc-setup-hub-welcome/);
    assert.match(css, /\.htc-staff \.htc-contract-agreement-guidance/);
  });
});

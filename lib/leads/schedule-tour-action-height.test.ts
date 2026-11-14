/**
 * Lead Workspace Schedule Tour must match adjacent size="sm" actions,
 * not the 44px mobile-tap cluster used for confirm / personal-link.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const panel = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");

describe("Schedule Tour action height", () => {
  it("keeps the Schedule Tour control as a size=sm action", () => {
    const block = panel.slice(
      panel.indexOf('data-testid="schedule-tour-action"') - 180,
      panel.indexOf('data-testid="schedule-tour-action"') + 120,
    );
    assert.match(block, /size="sm"/);
    assert.match(block, /htc-lead-tour-schedule-btn/);
    assert.match(panel, /data-testid="schedule-tour-action"/);
    assert.match(detail, /data-testid="start-booking-action"/);
    assert.match(detail, /TourScheduleActions includeCopyLink=\{false\} includeSchedule/);
  });

  it("does not put Schedule Tour in the compact tour-action or personal-link clusters", () => {
    const compact = css.slice(
      css.indexOf("/* Compact tour card actions"),
      css.indexOf("/* Match adjacent Lead Workspace size=\"sm\" actions"),
    );
    assert.match(compact, /htc-lead-tour-confirm-primary/);
    assert.match(compact, /height:\s*2\.25rem/);
    assert.match(compact, /htc-lead-tour-personal-link-btn/);
    assert.match(compact, /min-height:\s*2\.75rem/);
    assert.doesNotMatch(compact, /htc-lead-tour-schedule-btn/);
  });

  it("sizes Schedule Tour to adjacent h-8 / 2rem actions", () => {
    const rule = css.slice(
      css.indexOf(".htc-staff .htc-lead-tour-schedule-btn {"),
      css.indexOf(".htc-staff .htc-lead-tour-schedule-btn {") + 280,
    );
    assert.match(rule, /height:\s*2rem/);
    assert.match(rule, /min-height:\s*2rem/);
    assert.doesNotMatch(rule, /min-height:\s*2\.75rem/);
  });
});

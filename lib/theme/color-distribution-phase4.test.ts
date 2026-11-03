/**
 * Color Distribution Phase 4 — Setup Hub welcome + Contract agreement guidance.
 * Payment Schedule review banner is excluded (actionable reconciliation — not calm).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Color Distribution Phase 4 — Setup / Contract calm (schedule review excluded)", () => {
  const setup = read("app/(app)/setup-hub/page.tsx");
  const contract = read("components/contracts/contract-builder.tsx");
  const banner = read("components/payments/schedule-review-banner.tsx");
  const detail = read("components/payments/payment-schedule-detail.tsx");
  const css = read("app/globals.css");
  const tasks = read("components/tasks/task-center.tsx");
  const templates = read("app/(app)/communication/templates/page.tsx");
  const eo = read("app/(app)/library/event-order-templates/page.tsx");
  const settings = read("app/(app)/settings/page.tsx");
  const clients = read("components/clients/client-list.tsx");

  it("Setup Hub white-glove welcome uses staff-scoped calm class and keeps copy", () => {
    assert.match(setup, /htc-setup-hub-welcome/);
    assert.match(setup, /Welcome to Hello to Cheers/);
    assert.match(setup, /We&apos;ve already done a lot of the setup for you/);
    assert.match(setup, /invite couples/);
    assert.doesNotMatch(setup, /htc-setup-hub-welcome[\s\S]{0,80}bg-muted/);
    assert.match(setup, /<SetupHubOverview/);
  });

  it("Contract agreement guidance uses calm class and preserves disclaimer copy", () => {
    const idx = contract.indexOf('data-testid="contract-builder-agreement-guidance"');
    assert.ok(idx > 0);
    const block = contract.slice(Math.max(0, idx - 120), idx + 450);
    assert.match(block, /htc-contract-agreement-guidance/);
    assert.match(block, /Your agreement, your venue&apos;s terms/);
    assert.match(block, /not legal or tax/);
    assert.doesNotMatch(block, /bg-muted\/30/);
    assert.match(contract, /id="cb-content"/);
  });

  it("Schedule review banner is restored to pre-Phase 4 muted treatment (not calm)", () => {
    assert.match(
      banner,
      /className="rounded-sm border border-border bg-muted\/30 px-4 py-3 space-y-3"/,
    );
    assert.doesNotMatch(banner, /htc-schedule-review-banner/);
    assert.match(banner, /This payment plan no longer matches the invoice/);
    assert.match(banner, /Keep Existing Schedule/);
    assert.match(banner, /Regenerate Schedule/);
    assert.doesNotMatch(banner, /bg-destructive|text-destructive|AlertTriangle/);
    assert.match(
      detail,
      /commitmentMismatch && invoice && planHasActivity[\s\S]{0,80}<ScheduleReviewBanner/,
    );
  });

  it("Phase 4 CSS scopes calm tokens to Setup Hub + Contract only", () => {
    const start = css.indexOf(".htc-staff .htc-setup-hub-welcome");
    assert.ok(start > 0, "Phase 4 CSS block missing");
    const block = css.slice(start, css.indexOf(".htc-staff .htc-catalog-section", start));
    assert.match(block, /\.htc-staff \.htc-setup-hub-welcome/);
    assert.match(block, /\.htc-staff \.htc-contract-agreement-guidance/);
    assert.doesNotMatch(block, /htc-schedule-review-banner/);
    assert.match(block, /border-color:\s*var\(--htc-border-calm\)/);
    assert.match(block, /border-left:\s*3px solid var\(--htc-calm-blue-deep\)/);
    assert.match(block, /background-color:\s*var\(--htc-calm-blue\)/);
    assert.doesNotMatch(block, /#eaf1f7|#d5e1eb|#dfe9f1/i);
    assert.doesNotMatch(css, /\.htc-staff \.htc-schedule-review-banner/);
  });

  it("does not expand calm into excluded Phase 4 surfaces", () => {
    assert.doesNotMatch(tasks, /htc-setup-hub-welcome|htc-contract-agreement-guidance|htc-schedule-review-banner/);
    assert.match(tasks, /htc-surface-guidance/);
    assert.match(templates, /<LibraryHowItWorks>/);
    assert.doesNotMatch(templates, /LibraryHowItWorks tone=/);
    assert.match(eo, /data-testid="eo-templates-landing-example"/);
    assert.match(eo, /htc-surface-guidance/);
    assert.doesNotMatch(settings, /htc-setup-hub-welcome|htc-contract-agreement-guidance/);
    assert.match(clients, /data-testid="portal-activation-banner"/);
    assert.match(clients, /bg-muted\/20/);
  });

  it("preserves Phase 1–3 calm class anchors", () => {
    assert.match(css, /\.htc-staff \.htc-library-guidance-calm/);
    assert.match(css, /\.htc-staff \.htc-inbox-no-selection/);
    assert.match(css, /\.htc-staff \.htc-communication-health-guidance/);
    assert.match(css, /section\.htc-automations-help/);
  });
});

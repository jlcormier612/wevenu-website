/**
 * Color Distribution Phase 3 — AutomationsHelp + Communication Health guidance.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Color Distribution Phase 3 — Automations & Communication Health", () => {
  const help = read("components/communication/automations-help.tsx");
  const health = read("app/(app)/messaging/health/page.tsx");
  const form = read("components/communication/series-form.tsx");
  const seriesPage = read("app/(app)/communication/series/page.tsx");
  const templates = read("app/(app)/communication/templates/page.tsx");
  const guidance = read("components/library/library-guidance.tsx");
  const inbox = read("app/(app)/messaging/conversation-inbox.tsx");
  const css = read("app/globals.css");

  it("AutomationsHelp uses staff-scoped calm class and keeps copy", () => {
    assert.match(help, /htc-automations-help/);
    assert.match(help, /htc-automations-help-header/);
    assert.match(help, /htc-automations-help-body/);
    assert.doesNotMatch(help, /bg-muted\/30/);
    assert.match(help, /How automations work/);
    assert.match(help, /Automations are automatic relationship messages/);
  });

  it("AutomationsHelp callers are list, new, and edit only", () => {
    assert.match(seriesPage, /<AutomationsHelp/);
    assert.match(read("app/(app)/communication/series/new/page.tsx"), /<AutomationsHelp/);
    assert.match(read("app/(app)/communication/series/[id]/edit/page.tsx"), /<AutomationsHelp/);
    assert.doesNotMatch(read("app/(app)/communication/series/[id]/page.tsx"), /AutomationsHelp/);
    assert.doesNotMatch(templates, /AutomationsHelp/);
  });

  it("Communication Health how-to-read uses calm guidance class", () => {
    assert.match(health, /htc-communication-health-guidance/);
    assert.match(health, /How to read this page/);
    assert.doesNotMatch(health, /bg-muted\/20/);
  });

  it("What will happen uses calm guidance; template preview stays white working chrome", () => {
    assert.match(form, /What will happen\?/);
    assert.match(form, /htc-surface-guidance[\s\S]*What will happen|What will happen[\s\S]*htc-surface-guidance/);
    assert.match(form, /border border-border bg-card px-3 py-2\.5/);
    assert.doesNotMatch(form, /bg-muted\/20/);
    assert.match(form, /Saving changes applies to people who enter this automation after you save/);
    assert.doesNotMatch(form, /htc-automations-help|htc-communication-health-guidance/);
  });

  it("Message Templates HowItWorks uses calm guidance", () => {
    assert.match(templates, /LibraryHowItWorks tone="calm"/);
  });

  it("Phase 1 calm tone and Phase 2 inbox class remain intact", () => {
    assert.match(guidance, /"calm"/);
    assert.match(guidance, /htc-library-guidance-calm/);
    assert.match(inbox, /htc-inbox-no-selection/);
    assert.match(css, /\.htc-staff \.htc-library-guidance-calm/);
    assert.match(css, /\.htc-staff \.htc-inbox-no-selection/);
  });

  it("Phase 3 CSS uses locked tokens; AutomationsHelp expanded body is white", () => {
    const healthBlock = css.slice(
      css.indexOf(".htc-staff .htc-communication-health-guidance {"),
      css.indexOf("section.htc-automations-help"),
    );
    assert.match(healthBlock, /background-color:\s*var\(--htc-calm-blue\)/);

    const autoBlock = css.slice(
      css.indexOf("section.htc-automations-help"),
      css.indexOf(".htc-staff .htc-catalog-section"),
    );
    assert.match(autoBlock, /background-color:\s*var\(--htc-calm-blue\)/);
    assert.match(autoBlock, /\[data-expanded="true"\][\s\S]*background-color:\s*#ffffff/);
    assert.match(autoBlock, /button\.htc-automations-help-header[\s\S]*background-color:\s*var\(--htc-calm-blue\)/);
    assert.match(autoBlock, /\.htc-automations-help-body[\s\S]*background-color:\s*#ffffff/);
    assert.doesNotMatch(autoBlock, /#eaf1f7|#d5e1eb|#dfe9f1/i);
  });

  it("AutomationsHelp tracks expanded state for surface hierarchy", () => {
    assert.match(help, /data-expanded=\{open \? "true" : "false"\}/);
  });
});



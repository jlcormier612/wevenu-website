import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

function read(rel: string) {
  return readFileSync(rel, "utf8");
}

describe("Wave G2 — EO template edit washout", () => {
  it("uses hospitality page + working-card sections + calm orientation", () => {
    const detail = read("components/event-order-templates/event-order-template-detail.tsx");
    const wizard = read("components/event-order-templates/guided-setup-wizard.tsx");
    const choices = read("components/event-order-templates/package-choices-panel.tsx");
    const floorDefault = read("components/event-order-templates/section-floor-plan-default.tsx");
    const chrome = read("components/event-order-templates/template-workflow-chrome.tsx");

    assert.match(detail, /data-htc-phase12="eo-template-edit"/);
    assert.match(detail, /htc-hospitality-page/);
    assert.match(detail, /htc-surface-guidance[\s\S]*eo-template-detail-intro|eo-template-detail-intro[\s\S]*htc-surface-guidance/);
    assert.match(wizard, /htc-working-card/);
    assert.match(wizard, /htc-surface-guidance[\s\S]*eo-guided-no-sections|eo-guided-no-sections[\s\S]*htc-surface-guidance/);
    assert.match(choices, /eo-package-choices-empty[\s\S]*htc-surface-guidance|htc-surface-guidance[\s\S]*eo-package-choices-empty/);
    assert.match(floorDefault, /bg-card/);
    assert.doesNotMatch(floorDefault, /bg-muted\/30/);
    assert.match(chrome, /htc-badge-active/);
    assert.doesNotMatch(chrome, /bg-foreground text-background/);
    assert.match(chrome, /bg-card/);
  });
});

describe("Wave G2 — Timeline template editor chrome", () => {
  it("wraps items in working card, calm empty, botanical icon actions", () => {
    const page = read("app/(app)/library/timeline-templates/[id]/page.tsx");
    const editor = read("components/timeline-templates/timeline-template-editor.tsx");

    assert.match(page, /data-htc-phase12="timeline-template-edit"/);
    assert.match(page, /htc-hospitality-page/);
    assert.match(editor, /htc-working-card/);
    assert.match(editor, /timeline-template-empty[\s\S]*htc-surface-guidance|htc-surface-guidance[\s\S]*timeline-template-empty/);
    assert.match(editor, /htc-badge-active/);
    assert.match(editor, /variant="ghost"[\s\S]*size="icon-sm"/);
    assert.doesNotMatch(editor, /hover:bg-muted transition-colors/);
    assert.doesNotMatch(editor, /bg-muted\/20/);
  });
});

describe("Wave G2 — Floor Plan template editor chrome", () => {
  it("uses hospitality shell + working-card around layout editor", () => {
    const page = read("app/(app)/library/floor-plan-templates/[id]/page.tsx");
    const editor = read("components/floor-plan/floor-plan-editor.tsx");

    assert.match(page, /data-htc-phase12="floor-plan-template-edit"/);
    assert.match(page, /htc-hospitality-page/);
    assert.match(page, /htc-working-card/);
    assert.match(page, /Layout editor/);
    assert.match(editor, /htc-surface-guidance/);
    assert.doesNotMatch(editor, /bg-muted\/30/);
    assert.doesNotMatch(editor, /bg-muted\/20/);
  });
});

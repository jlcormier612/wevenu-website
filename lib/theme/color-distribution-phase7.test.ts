/**
 * Color Distribution Phase 7 — Venue Guide orientation + Contract template disclaimer.
 * Help amber callouts, Message Templates, EO Example remain excluded.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Color Distribution Phase 7 — Venue Guide + Contract template disclaimer", () => {
  const guide = read("components/guide/venue-guide-editor.tsx");
  const templateForm = read("components/contracts/template-form.tsx");
  const contractBuilder = read("components/contracts/contract-builder.tsx");
  const helpSlug = read("app/(app)/help/[slug]/page.tsx");
  const messageTemplates = read("app/(app)/communication/templates/page.tsx");
  const eo = read("app/(app)/library/event-order-templates/page.tsx");
  const css = read("app/globals.css");

  it("Venue Guide orientation uses calm class and preserves copy", () => {
    assert.match(guide, /htc-venue-guide-orientation/);
    assert.match(guide, /data-testid="venue-guide-orientation"/);
    assert.match(guide, /What clients see here/);
    assert.match(guide, /source of truth clients and vendors read in their portals/);
    assert.match(guide, /\/settings\/business/);
    assert.match(guide, /\/settings\/communications/);
    assert.equal((guide.match(/htc-venue-guide-orientation/g) ?? []).length, 1);
    // Other muted UI on the page must not inherit the orientation class.
    assert.match(guide, /bg-muted\/30/);
    assert.doesNotMatch(
      guide,
      /htc-venue-guide-orientation[\s\S]{0,40}bg-muted\/30|bg-muted\/30[\s\S]{0,80}htc-venue-guide-orientation/,
    );
  });

  it("Contract template disclaimer uses calm after semantic parallel to Phase 4 agreement guidance", () => {
    assert.match(templateForm, /htc-contract-template-disclaimer/);
    assert.match(templateForm, /data-testid="contract-template-disclaimer"/);
    assert.match(templateForm, /This is your/);
    assert.match(templateForm, /template/);
    assert.match(templateForm, /does not provide legal advice/);
    assert.match(templateForm, /language approved for your venue/);
    assert.match(templateForm, /edits here do not change agreements already created for clients/);
    assert.equal((templateForm.match(/htc-contract-template-disclaimer/g) ?? []).length, 1);
    // Phase 4 Contract Builder guidance remains its own class.
    assert.match(contractBuilder, /htc-contract-agreement-guidance/);
    assert.doesNotMatch(contractBuilder, /htc-contract-template-disclaimer|htc-venue-guide-orientation/);
  });

  it("Phase 7 CSS scopes calm tokens to Venue Guide orientation + template disclaimer", () => {
    const start = css.indexOf(".htc-staff .htc-venue-guide-orientation");
    assert.ok(start > 0);
    const block = css.slice(start, start + 450);
    assert.match(block, /\.htc-staff \.htc-venue-guide-orientation/);
    assert.match(block, /\.htc-staff \.htc-contract-template-disclaimer/);
    assert.match(block, /background-color:\s*var\(--htc-calm-blue\)/);
    assert.match(block, /border-left:\s*3px solid var\(--htc-calm-blue-deep\)/);
    assert.match(block, /border-color:\s*var\(--htc-border-calm\)/);
    assert.doesNotMatch(block, /#eaf1f7|#d5e1eb|#dfe9f1/i);
  });

  it("does not expand Phase 7 into excluded surfaces", () => {
    assert.match(helpSlug, /border-amber-500\/30 bg-amber-500\/5/);
    assert.match(messageTemplates, /LibraryHowItWorks tone="calm"/);
    assert.match(eo, /data-testid="eo-templates-landing-example"/);
    assert.match(eo, /LibraryDependencyNote[\s\S]*tone="calm"/);
    assert.doesNotMatch(helpSlug, /htc-venue-guide-orientation|htc-contract-template-disclaimer/);
  });

  it("preserves Phase 1–6 calm CSS anchors", () => {
    assert.match(css, /\.htc-staff \.htc-library-guidance-calm/);
    assert.match(css, /\.htc-staff \.htc-inbox-no-selection/);
    assert.match(css, /\.htc-staff \.htc-communication-health-guidance/);
    assert.match(css, /section\.htc-automations-help/);
    assert.match(css, /\.htc-staff \.htc-setup-hub-welcome/);
    assert.match(css, /\.htc-staff \.htc-contract-agreement-guidance/);
    assert.match(css, /\.htc-staff \.htc-task-center-plate-clear/);
    assert.match(css, /\.htc-staff \.htc-availability-settings-guidance/);
    assert.match(css, /\.htc-staff \.htc-migration-guidance/);
    assert.match(css, /\.htc-staff \.htc-import-cutover-pointer/);
  });
});

/**
 * Dashboard light-mode hospitality — source lock after palette expansion.
 * docs/design/htc-visual-system.md · docs/design/htc-dashboard-light-specification.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Dashboard hospitality light mode", () => {
  const css = read("app/globals.css");
  const page = read("app/(app)/dashboard/page.tsx");
  const shell = read("components/dashboard-system/dashboard-card-shell.tsx");
  const attention = read("components/dashboard-system/attention-list.tsx");
  const focusRow = read("components/dashboard-system/focus-attention-row.tsx");
  const luv = read("components/dashboard/luv-dashboard-entry.tsx");
  const snapshot = read("components/dashboard/business-snapshot.tsx");

  it("uses hospitality page canvas and heading card", () => {
    assert.match(page, /htc-hospitality-page/);
    assert.match(page, /htc-hospitality-heading/);
    assert.match(page, /space-y-4 sm:space-y-6/);
  });

  it("gives Today's Focus an eucalyptus header band and Coming up calm-blue guidance", () => {
    assert.match(attention, /headerBand/);
    assert.match(shell, /htc-eucalyptus-surface/);
    const focusIdx = page.indexOf('title="Today\'s Focus"');
    const focusBand = page.indexOf('headerBand="eucalyptus"', focusIdx);
    const comingIdx = page.indexOf('title="Coming up"');
    assert.ok(focusIdx >= 0 && focusBand > focusIdx && focusBand < comingIdx);
    assert.match(page.slice(comingIdx, comingIdx + 500), /headerBand="none"/);
    assert.match(page.slice(comingIdx, comingIdx + 500), /htc-surface-guidance/);
  });

  it("marks critical Focus with soft-rose left strip; rows blush on hover with record-link titles", () => {
    assert.match(focusRow, /isCritical/);
    assert.match(focusRow, /htc-soft-rose/);
    assert.match(focusRow, /border-l-\[3px\]/);
    assert.match(focusRow, /htc-ivory/);
    assert.match(focusRow, /htc-focus-attention-row/);
    assert.match(focusRow, /htc-record-link/);
    assert.match(css, /\.htc-focus-attention-row:hover[\s\S]*--htc-soft-blush/);
    assert.match(focusRow, /severity === "critical"/);
    assert.match(focusRow, /text-warning-foreground/);
    assert.match(focusRow, /data-severity/);
  });

  it("styles Luv with white body and blush accent strip — not full blush card or destructive mix", () => {
    assert.match(luv, /bg-card/);
    assert.match(luv, /data-luv-accent/);
    assert.match(luv, /data-luv-accent[\s\S]*?htc-soft-blush|htc-soft-blush[\s\S]*?data-luv-accent/);
    assert.doesNotMatch(luv, /border-rose/);
    assert.doesNotMatch(luv, /var\(--destructive\)/);
    assert.doesNotMatch(luv, /Card className="[^"]*bg-\[var\(--htc-soft-blush\)\]/);
    assert.doesNotMatch(luv, /bg-\[var\(--htc-ivory\)\]/);
    assert.doesNotMatch(luv, /text-primary/);
  });

  it("applies Snapshot coordinated surfaces without full Outstanding blush card", () => {
    assert.match(snapshot, /lead_flow/);
    assert.match(snapshot, /htc-eucalyptus-surface/);
    assert.match(snapshot, /htc-green-mist/);
    assert.match(snapshot, /htc-botanical-pale/);
    assert.match(snapshot, /outstandingActive/);
    assert.match(snapshot, /outstandingEmpty/);
    assert.match(snapshot, /htc-ivory/);
    assert.match(snapshot, /htc-soft-blush/);
    assert.match(snapshot, /card\.key === "outstanding" && !card\.empty/);
    assert.match(snapshot, /card\.key === "outstanding" && card\.empty/);
    assert.doesNotMatch(
      snapshot,
      /outstandingBlush[\s\S]*bg-\[var\(--htc-soft-blush\)\] hover/,
    );
    assert.doesNotMatch(snapshot, /text-primary/);
  });

  it("keeps Reports as a quiet white secondary row", () => {
    assert.match(page, /View Reports/);
    assert.match(page, /htc-border-warm/);
    assert.match(page, /rounded-\[0\.75rem\]/);
  });
});

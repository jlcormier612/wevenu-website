import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("Navigation pending — keep previous page painted", () => {
  it("keeps App Router children out of a client wrapper; overlay is a sibling", () => {
    const shell = readFileSync(resolve("components/shell/workspace-shell.tsx"), "utf8");
    assert.match(shell, /NavigationPendingMainOverlay/);
    assert.match(shell, /\{children\}/);
    assert.doesNotMatch(
      shell,
      /NavigationPendingMainOverlay[\s\S]*\{children\}[\s\S]*<\/NavigationPendingMainOverlay>/,
    );
  });

  it("snapshots previous page HTML instead of showing a skeleton over empty main", () => {
    const src = readFileSync(resolve("components/shell/navigation-pending.tsx"), "utf8");
    assert.match(src, /capturePageSlotHtml/);
    assert.match(src, /data-nav-snapshot/);
    assert.match(src, /dangerouslySetInnerHTML/);
    assert.match(src, /htc-nav-pending-snapshot/);
    assert.doesNotMatch(src, /HospitalityRouteLoading/);
  });

  it("clears snapshot when destination module heading streams (first paint)", () => {
    const src = readFileSync(resolve("components/shell/navigation-pending.tsx"), "utf8");
    assert.match(src, /mainHasUsableContent/);
    assert.match(src, /htc-hospitality-heading/);
    assert.match(src, /streaming-root/);
    assert.match(src, /CONTENT_POLL_MS/);
    assert.doesNotMatch(src, /scheduleClearAfterMinVisible/);
  });

  it("does not restore forbidden workspace-level loading.tsx", () => {
    assert.equal(existsSync(resolve("app/(app)/loading.tsx")), false);
  });

  it("does not restore leads list full-route loading.tsx", () => {
    assert.equal(existsSync(resolve("app/(app)/leads/loading.tsx")), false);
  });

  it("does not modify Soft-URL / soft-filter engines", () => {
    assert.match(
      readFileSync(resolve("lib/clients/soft-url.ts"), "utf8"),
      /clientsFilterHref/,
    );
    assert.match(
      readFileSync(resolve("lib/leads/soft-filter.test.ts"), "utf8"),
      /replaceLeadsListAction/,
    );
  });
});

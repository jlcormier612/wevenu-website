import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("Navigation pending main overlay (white-main fix)", () => {
  it("keeps App Router children out of a client wrapper; overlay is a sibling", () => {
    const shell = readFileSync(resolve("components/shell/workspace-shell.tsx"), "utf8");
    assert.match(shell, /NavigationPendingMainOverlay/);
    assert.match(shell, /\{children\}/);
    // Overlay must not wrap children
    assert.doesNotMatch(
      shell,
      /NavigationPendingMainOverlay[\s\S]*\{children\}[\s\S]*<\/NavigationPendingMainOverlay>/,
    );
    assert.match(shell, /relative min-h-0 min-w-0 flex-1/);
  });

  it("persists pending href so force-dynamic remount cannot wipe the indicator", () => {
    const src = readFileSync(resolve("components/shell/navigation-pending.tsx"), "utf8");
    assert.match(src, /htc-nav-pending-href/);
    assert.match(src, /sessionStorage/);
    assert.match(src, /data-testid="navigation-pending-main"/);
    assert.match(src, /HospitalityRouteLoading/);
  });

  it("does not restore forbidden workspace-level loading.tsx", () => {
    assert.equal(existsSync(resolve("app/(app)/loading.tsx")), false);
  });

  it("does not restore leads list full-route loading.tsx", () => {
    assert.equal(existsSync(resolve("app/(app)/leads/loading.tsx")), false);
  });
});

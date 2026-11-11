import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

describe("workspace main scrollport", () => {
  const shell = readFileSync(
    join(process.cwd(), "components/shell/workspace-shell.tsx"),
    "utf8",
  );
  const bridge = readFileSync(
    join(process.cwd(), "components/shell/workspace-main-scroll-bridge.tsx"),
    "utf8",
  );
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const switcher = readFileSync(
    join(process.cwd(), "components/shell/venue-switcher.tsx"),
    "utf8",
  );

  it("keeps the App Router page slot on the server shell (no client wrapper around children)", () => {
    assert.match(shell, /\{children\}/);
    assert.doesNotMatch(shell, /WorkspaceShellClient/);
    assert.match(shell, /WorkspaceMainScrollBridge/);
    // Bridge is a sibling of main, not a wrapper of the page slot.
    assert.match(bridge, /return null/);
  });

  it("uses a dedicated main scrollport with stable scrollbar gutter styles", () => {
    assert.match(shell, /overflow-y-scroll/);
    assert.match(shell, /overflow-x-clip/);
    assert.match(css, /scrollbar-gutter:\s*stable/);
    assert.match(css, /::-webkit-scrollbar/);
  });

  it("forwards PageDown to main when document scroll is locked", () => {
    assert.match(bridge, /PageDown/);
    assert.match(bridge, /data-workspace-main/);
    assert.match(bridge, /scrollBy/);
  });

  it("does not regress venue-switch hard navigation", () => {
    assert.match(switcher, /window\.location\.assign\("\/dashboard"\)/);
    assert.doesNotMatch(switcher, /\brouter\.(replace|refresh)\b/);
  });
});

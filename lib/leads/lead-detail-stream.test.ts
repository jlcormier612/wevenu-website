import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("Lead detail streaming / hydration", () => {
  it("does not use a workspace-level loading.tsx that parks the page in hidden #S:0", () => {
    assert.equal(existsSync(resolve("app/(app)/loading.tsx")), false);
  });

  it("keeps the App Router page slot in a Server Component shell, not a client wrapper", () => {
    const shell = readFileSync(resolve("components/shell/workspace-shell.tsx"), "utf8");
    assert.doesNotMatch(shell, /^["']use client["']/m);
    assert.match(shell, /\{children\}/);
    const header = readFileSync(resolve("components/shell/workspace-shell-header.tsx"), "utf8");
    assert.match(header, /^["']use client["']/m);
    assert.doesNotMatch(header, /children:/);
  });

  it("layout passes the request pathname into the server shell", () => {
    const layout = readFileSync(resolve("app/(app)/layout.tsx"), "utf8");
    assert.match(layout, /pathname=\{pathname\}/);
  });
});

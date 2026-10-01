import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Layout regression: portal root is h-svh + overflow-hidden for PortalShell.
 * Financial Invoice & Payment Plan must nest a vertical scroll container.
 */
describe("payment access scroll layout", () => {
  it("wraps financial PaymentAccessShell in an overflow-y scroll region", () => {
    const page = readFileSync("app/(portal)/p/[token]/page.tsx", "utf8");
    assert.match(page, /accessLevel === "financial"/);
    assert.match(page, /h-full overflow-y-auto overscroll-contain/);
    assert.match(page, /PaymentAccessShell/);
  });

  it("keeps portal layout overflow clipped (PortalShell contract)", () => {
    const layout = readFileSync("app/(portal)/layout.tsx", "utf8");
    assert.match(layout, /h-svh overflow-hidden/);
  });
});

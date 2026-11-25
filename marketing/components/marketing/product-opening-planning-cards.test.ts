import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

/**
 * Regression: Client Home planning cards must ship the approved PNG without
 * depending on the Production ECS /_next/image path that hangs on w=828.
 */
describe("product-opening planning cards image", () => {
  const src = readFileSync(
    join(__dirname, "product-opening.tsx"),
    "utf8",
  );

  it("references the approved product-s12 planning-cards asset", () => {
    assert.match(src, /clientPlanningCards/);
    assert.match(
      src,
      /Client Home planning cards — Wedding Website, Guest List, Budget, Seating, Plans, and Our Story/,
    );
  });

  it("serves the planning-cards Image unoptimized (exact approved PNG)", () => {
    const block = src.slice(
      src.indexOf("po-shot-planning"),
      src.indexOf("po-block-vendor"),
    );
    assert.match(block, /unoptimized/);
    assert.doesNotMatch(block, /LcpPicture/);
  });
});

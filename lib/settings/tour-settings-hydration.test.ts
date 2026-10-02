import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

/**
 * React #418 / hydration: booking URL must not branch on `window` in render.
 * Absolute origin belongs only in click handlers (copy / open).
 */
describe("Tour settings booking URL hydration safety", () => {
  const src = readFileSync(
    join(process.cwd(), "components/settings/tour-settings-section.tsx"),
    "utf8",
  );

  it("does not branch bookingUrl display on typeof window", () => {
    assert.doesNotMatch(
      src,
      /bookingUrl\s*=\s*tourPath[\s\S]*?typeof window/,
    );
    assert.doesNotMatch(
      src,
      /typeof window !== ["']undefined["']\s*\?\s*`\$\{window\.location\.origin\}/,
    );
  });

  it("renders the relative booking path and absolutizes only in handlers", () => {
    assert.match(src, /const bookingUrl = publicTourSchedulingPath\(s\.tourEmbedKey\) \?\? ""/);
    assert.match(src, /function absoluteBookingUrl\(\)/);
    assert.match(src, /navigator\.clipboard\.writeText\(absoluteBookingUrl\(\)\)/);
    assert.match(src, /window\.open\(absoluteBookingUrl\(\)/);
    assert.match(src, /\{bookingUrl\}/);
  });
});

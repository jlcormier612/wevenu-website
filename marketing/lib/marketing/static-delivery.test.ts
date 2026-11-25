import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const marketingRoot = join(__dirname, "../..");

describe("marketing static image delivery", () => {
  it("disables the runtime next/image optimizer", () => {
    const cfg = readFileSync(join(marketingRoot, "next.config.ts"), "utf8");
    assert.match(cfg, /unoptimized:\s*true/);
  });

  it("keeps planning-cards on the exact approved PNG path", () => {
    const src = readFileSync(
      join(marketingRoot, "components/marketing/product-opening.tsx"),
      "utf8",
    );
    assert.match(src, /clientPlanningCards/);
    assert.match(src, /unoptimized/);
  });

  it("has derived manifest and generated assets after pregenerate", () => {
    const manifestPath = join(
      marketingRoot,
      "public/marketing/derived/manifest.json",
    );
    assert.ok(existsSync(manifestPath), "manifest missing — run pregenerate");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.ok(Object.keys(manifest.images || {}).length >= 10);
    for (const img of Object.values(manifest.images) as { source: string; variants: Record<string, { path: string }> }[]) {
      const orig = join(marketingRoot, "public", img.source.replace(/^\//, ""));
      assert.ok(existsSync(orig), `original missing ${img.source}`);
      for (const v of Object.values(img.variants)) {
        const der = join(marketingRoot, "public", v.path.replace(/^\//, ""));
        assert.ok(existsSync(der), `derived missing ${v.path}`);
      }
    }
  });
});

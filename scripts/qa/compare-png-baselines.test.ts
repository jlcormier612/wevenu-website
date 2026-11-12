/**
 * Proves the visual guard fails on meaningful pixel regressions and passes
 * when current matches approved — not merely that screenshots were captured.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  compareBaselineDirs,
  comparePngBuffers,
} from "./compare-png-baselines.mts";

function solidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      png.data[i] = rgb[0];
      png.data[i + 1] = rgb[1];
      png.data[i + 2] = rgb[2];
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

describe("comparePngBuffers — genuine visual regression guard", () => {
  it("passes when buffers are identical", () => {
    const img = solidPng(32, 24, [68, 107, 86]);
    const result = comparePngBuffers(img, img, { key: "identical", maxDiffRatio: 0.01 });
    assert.equal(result.ok, true);
    assert.equal(result.diffPixels, 0);
    assert.equal(result.diffRatio, 0);
  });

  it("fails when a large region changes color (meaningful regression)", () => {
    const approved = solidPng(40, 40, [248, 247, 243]);
    const current = solidPng(40, 40, [255, 0, 0]);
    const result = comparePngBuffers(approved, current, {
      key: "washed-out",
      maxDiffRatio: 0.01,
    });
    assert.equal(result.ok, false);
    assert.ok((result.diffRatio ?? 0) > 0.9);
    assert.match(result.reason ?? "", /diffRatio/);
  });

  it("fails on dimension mismatch instead of silently capturing", () => {
    const approved = solidPng(100, 50, [0, 0, 0]);
    const current = solidPng(90, 50, [0, 0, 0]);
    const result = comparePngBuffers(approved, current, { key: "size" });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /dimension mismatch/);
  });

  it("compareBaselineDirs fails when current diverges from approved", () => {
    const root = mkdtempSync(join(tmpdir(), "htc-visual-"));
    try {
      const approvedDir = join(root, "approved");
      const currentDir = join(root, "current");
      const diffsDir = join(root, "diffs");
      mkdirSync(approvedDir);
      mkdirSync(currentDir);
      writeFileSync(join(approvedDir, "reporting-overview.png"), solidPng(60, 40, [68, 107, 86]));
      writeFileSync(join(currentDir, "reporting-overview.png"), solidPng(60, 40, [255, 255, 255]));
      const { ok, results } = compareBaselineDirs({
        approvedDir,
        currentDir,
        diffsDir,
        maxDiffRatio: 0.01,
      });
      assert.equal(ok, false);
      assert.equal(results[0]?.ok, false);
      assert.ok((results[0]?.diffRatio ?? 0) > 0.5);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("compareBaselineDirs passes when a rendered current tree matches approved", () => {
    const approvedDir = "docs/design/hospitality-visual-baselines/approved";
    const root = mkdtempSync(join(tmpdir(), "htc-visual-match-"));
    const currentDir = join(root, "current");
    const diffsDir = join(root, "diffs");
    try {
      mkdirSync(currentDir);
      // Simulate a fresh capture that matches the locked approved matrix.
      for (const file of ["reporting-overview__desktop.png", "templates__mobile.png", "billing__desktop.png"]) {
        writeFileSync(join(currentDir, file), readFileSync(join(approvedDir, file)));
      }
      // Only compare the files present in this stub current against the same keys in approved
      // by writing a mini approved dir.
      const miniApproved = join(root, "approved");
      mkdirSync(miniApproved);
      for (const file of ["reporting-overview__desktop.png", "templates__mobile.png", "billing__desktop.png"]) {
        writeFileSync(join(miniApproved, file), readFileSync(join(approvedDir, file)));
      }
      const { ok, results } = compareBaselineDirs({
        approvedDir: miniApproved,
        currentDir,
        diffsDir,
        maxDiffRatio: 0.01,
      });
      assert.equal(ok, true, JSON.stringify(results.filter((r) => !r.ok)));
      assert.equal(results.length, 3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("approved hospitality baseline matrix exists for desktop and mobile", () => {
    const approvedDir = "docs/design/hospitality-visual-baselines/approved";
    const required = [
      "reporting-overview",
      "dashboard",
      "templates",
      "billing",
      "org-settings",
      "communication-templates",
      "timeline-templates",
      "questionnaire-templates",
    ];
    for (const key of required) {
      for (const vp of ["desktop", "mobile"] as const) {
        const buf = readFileSync(join(approvedDir, `${key}__${vp}.png`));
        assert.ok(buf.length > 1000, `${key}__${vp} too small`);
        assert.equal(buf[0], 0x89); // PNG magic
      }
    }
  });
});


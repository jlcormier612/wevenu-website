/**
 * Pixel-diff PNG baselines.
 *
 * Compares rendered screenshots under `current/` against approved baselines.
 * Exit 1 when any route exceeds the max differing-pixel ratio — capture-only
 * is not a pass.
 *
 * Usage:
 *   npx tsx scripts/qa/compare-png-baselines.mts
 *   npx tsx scripts/qa/compare-png-baselines.mts --max-diff-ratio=0.01
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";

export type CompareResult = {
  key: string;
  ok: boolean;
  reason?: string;
  width?: number;
  height?: number;
  diffPixels?: number;
  totalPixels?: number;
  diffRatio?: number;
  approvedSha?: string;
  currentSha?: string;
  diffPath?: string;
};

const ROOT = resolve("docs/design/hospitality-visual-baselines");
const APPROVED = resolve(ROOT, "approved");
const CURRENT = resolve(ROOT, "current");
const DIFFS = resolve(ROOT, "diffs");

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

function parseMaxRatio(argv: string[]): number {
  const flag = argv.find((a) => a.startsWith("--max-diff-ratio="));
  if (!flag) return 0.01;
  const n = Number(flag.split("=")[1]);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`Invalid --max-diff-ratio: ${flag}`);
  }
  return n;
}

/** Pure pixel compare of two PNG buffers. Writes an optional red-diff PNG. */
export function comparePngBuffers(
  approvedBuf: Buffer,
  currentBuf: Buffer,
  opts: { maxDiffRatio?: number; diffOutPath?: string; key?: string } = {},
): CompareResult {
  const key = opts.key ?? "image";
  const maxDiffRatio = opts.maxDiffRatio ?? 0.01;
  const approvedSha = sha256(approvedBuf);
  const currentSha = sha256(currentBuf);

  if (approvedSha === currentSha) {
    return {
      key,
      ok: true,
      diffPixels: 0,
      totalPixels: 0,
      diffRatio: 0,
      approvedSha,
      currentSha,
    };
  }

  let approved: PNG;
  let current: PNG;
  try {
    approved = PNG.sync.read(approvedBuf);
    current = PNG.sync.read(currentBuf);
  } catch (err) {
    return {
      key,
      ok: false,
      reason: `PNG decode failed: ${err instanceof Error ? err.message : String(err)}`,
      approvedSha,
      currentSha,
    };
  }

  if (approved.width !== current.width || approved.height !== current.height) {
    return {
      key,
      ok: false,
      reason: `dimension mismatch approved=${approved.width}x${approved.height} current=${current.width}x${current.height}`,
      width: current.width,
      height: current.height,
      approvedSha,
      currentSha,
    };
  }

  const { width, height, data: a } = approved;
  const b = current.data;
  const totalPixels = width * height;
  const diff = new PNG({ width, height });
  let diffPixels = 0;

  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i]! - b[i]!);
    const dg = Math.abs(a[i + 1]! - b[i + 1]!);
    const db = Math.abs(a[i + 2]! - b[i + 2]!);
    const da = Math.abs(a[i + 3]! - b[i + 3]!);
    // Ignore tiny antialias / compression noise (≤2 per channel).
    const changed = dr > 2 || dg > 2 || db > 2 || da > 2;
    if (changed) {
      diffPixels += 1;
      diff.data[i] = 255;
      diff.data[i + 1] = 0;
      diff.data[i + 2] = 0;
      diff.data[i + 3] = 255;
    } else {
      // Dim approved pixel for context.
      diff.data[i] = Math.floor(a[i]! * 0.35);
      diff.data[i + 1] = Math.floor(a[i + 1]! * 0.35);
      diff.data[i + 2] = Math.floor(a[i + 2]! * 0.35);
      diff.data[i + 3] = 255;
    }
  }

  const diffRatio = totalPixels === 0 ? 0 : diffPixels / totalPixels;
  let diffPath: string | undefined;
  if (opts.diffOutPath) {
    mkdirSync(resolve(opts.diffOutPath, ".."), { recursive: true });
    writeFileSync(opts.diffOutPath, PNG.sync.write(diff));
    diffPath = opts.diffOutPath;
  }

  const ok = diffRatio <= maxDiffRatio;
  return {
    key,
    ok,
    reason: ok ? undefined : `diffRatio ${diffRatio.toFixed(4)} > max ${maxDiffRatio}`,
    width,
    height,
    diffPixels,
    totalPixels,
    diffRatio,
    approvedSha,
    currentSha,
    diffPath,
  };
}

export function compareBaselineDirs(opts: {
  approvedDir?: string;
  currentDir?: string;
  diffsDir?: string;
  maxDiffRatio?: number;
}): { ok: boolean; results: CompareResult[] } {
  const approvedDir = opts.approvedDir ?? APPROVED;
  const currentDir = opts.currentDir ?? CURRENT;
  const diffsDir = opts.diffsDir ?? DIFFS;
  const maxDiffRatio = opts.maxDiffRatio ?? 0.01;

  if (!existsSync(approvedDir)) {
    throw new Error(`Approved baselines missing: ${approvedDir}`);
  }
  if (!existsSync(currentDir)) {
    throw new Error(`Current screenshots missing: ${currentDir}`);
  }

  mkdirSync(diffsDir, { recursive: true });
  const approvedFiles = readdirSync(approvedDir).filter((f) => f.endsWith(".png")).sort();
  if (approvedFiles.length === 0) {
    throw new Error(`No approved PNG baselines in ${approvedDir}`);
  }

  const results: CompareResult[] = [];
  for (const file of approvedFiles) {
    const key = basename(file, ".png");
    const approvedPath = resolve(approvedDir, file);
    const currentPath = resolve(currentDir, file);
    if (!existsSync(currentPath)) {
      results.push({
        key,
        ok: false,
        reason: `missing current screenshot: ${currentPath}`,
      });
      continue;
    }
    results.push(
      comparePngBuffers(readFileSync(approvedPath), readFileSync(currentPath), {
        key,
        maxDiffRatio,
        diffOutPath: resolve(diffsDir, file),
      }),
    );
  }

  // Fail if current has screenshots that were never approved (orphan drift).
  for (const file of readdirSync(currentDir).filter((f) => f.endsWith(".png"))) {
    if (!approvedFiles.includes(file)) {
      results.push({
        key: basename(file, ".png"),
        ok: false,
        reason: `current screenshot has no approved baseline: ${file}`,
      });
    }
  }

  return { ok: results.every((r) => r.ok), results };
}

function main() {
  const maxDiffRatio = parseMaxRatio(process.argv.slice(2));
  const { ok, results } = compareBaselineDirs({ maxDiffRatio });
  const report = {
    at: new Date().toISOString(),
    maxDiffRatio,
    ok,
    results,
  };
  writeFileSync(resolve(ROOT, "last-compare.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    const failed = results.filter((r) => !r.ok);
    console.error(`FAIL: ${failed.length} visual baseline regression(s)`);
    process.exit(1);
  }
  console.error(`PASS: ${results.length} screenshot(s) within maxDiffRatio=${maxDiffRatio}`);
}

const isDirectRun =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]!);
if (isDirectRun) {
  main();
}

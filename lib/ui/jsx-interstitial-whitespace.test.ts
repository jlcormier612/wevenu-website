/**
 * RSC / Next Flight turns interstitial JSX whitespace after `{expr}` into an
 * HTML comment (`<!-- -->`), which does not render as a visible space.
 *
 * Example failure:
 *   {n} item{n !== 1 ? "s" : ""} need attention
 * serializes to: 3<!-- --> item<!-- -->s<!-- -->need attention
 * textContent: "3 itemsneed attention"
 *
 * Safe: compose the sentence in one JS string so spaces are character data.
 *   {`${n} item${n !== 1 ? "s" : ""} need attention`}
 *
 * This test locks the known-bad staff-app pattern out of JSX children.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(process.cwd());
const SKIP = new Set(["node_modules", ".next", ".worktrees", "dist", "coverage"]);

/** Ternary expression closing, then a space, then a word — space becomes a comment. */
const RISKY =
  /\? (?:""|"[^"]*"|'[^']*') : (?:""|"[^"]*"|'[^']*')\} [A-Za-z]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx") || name.endsWith(".jsx")) out.push(p);
  }
  return out;
}

function isInsideTemplateLiteral(line: string, index: number): boolean {
  // Odd number of backticks before the match ⇒ currently inside `...`.
  const ticks = line.slice(0, index).split("`").length - 1;
  return ticks % 2 === 1;
}

function isAttributeNoise(line: string, index: number): boolean {
  const before = line.slice(0, index);
  return (
    /className\s*=/.test(before) ||
    /variant\s*=/.test(before) ||
    /status\s*=/.test(before) ||
    /placeholder\s*=/.test(before) ||
    /model\s*=/.test(before) ||
    /label\s*=/.test(before) ||
    /size\s*=/.test(before)
  );
}

describe("JSX interstitial whitespace after expressions", () => {
  it("does not leave pluralization/sentence spaces as JSX interstitial whitespace", () => {
    const files = [
      ...walk(join(ROOT, "app")),
      ...walk(join(ROOT, "components")),
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        for (const match of line.matchAll(new RegExp(RISKY, "g"))) {
          const idx = match.index ?? 0;
          if (isInsideTemplateLiteral(line, idx)) continue;
          if (isAttributeNoise(line, idx)) continue;
          offenders.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `RSC-unsafe JSX spacing (compose with a template string instead):\n${offenders.join("\n")}`,
    );
  });

  it("Task Center attention banner composes as one string", () => {
    const src = readFileSync(join(ROOT, "components/tasks/task-center.tsx"), "utf8");
    assert.match(
      src,
      /\$\{doImmediate\} item\$\{doImmediate !== 1 \? "s" : ""\} need attention on your team's list/,
    );
    assert.doesNotMatch(
      src,
      /item\{doImmediate !== 1 \? "s" : ""\} need attention/,
    );
  });
});

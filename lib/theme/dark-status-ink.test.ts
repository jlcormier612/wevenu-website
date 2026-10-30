/**
 * Dark staff theme — light-mode status utilities (amber/red text + fills,
 * text-destructive, text-warning) must be remapped so warning labels such as
 * Offerings "Unpriced" and Event Order template hints stay legible.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { contrastRatio } from "@/lib/theme/public-form-surface";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const block = css.slice(
  css.indexOf("DARK STAFF — status ink legibility"),
  css.indexOf("STAFF PRIMITIVES — CRM-like chrome"),
);

const HERITAGE_SAGE = "#5d6f5d";
const FOREST_SAGE = "#4f5f4f";
const DUSTY_ROSE = "#d8a7aa";
const TAUPE_DARK = "#b8aea1";

function mixWithWhite(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `#${ch.map((c) => Math.round(c * pct + 255 * (1 - pct)).toString(16).padStart(2, "0")).join("")}`;
}

function assertAA(fg: string, bg: string, label: string) {
  const ratio = contrastRatio(fg, bg) ?? 0;
  assert.ok(ratio >= 4.5, `${label}: ${ratio.toFixed(2)}:1 (need ≥4.5)`);
}

describe("dark staff status ink", () => {
  it("block exists and is scoped to dark staff", () => {
    assert.ok(block.length > 0, "status ink block missing from globals.css");
    assert.match(block, /html\.dark:has\(\.htc-staff\)/);
  });

  it("remaps amber-800 text (Unpriced badge / picker hints) and respects explicit dark: overrides", () => {
    assert.match(block, /\[class~="text-amber-800"\]/);
    assert.match(block, /:not\(\[class\*="dark:text-"\]\)/);
    assert.match(block, /color:\s*#fef3c7/);
  });

  it("remaps text-destructive, text-warning, amber/red fills and borders", () => {
    assert.match(block, /\[class~="text-destructive"\]/);
    assert.match(block, /\[class~="text-warning"\]/);
    assert.match(block, /\[class~="bg-amber-50"\]/);
    assert.match(block, /\[class~="border-amber-300"\]/);
    assert.match(block, /\[class~="bg-red-50"\]/);
  });

  it("remapped ink clears AA on Heritage Sage cards and Forest Sage page", () => {
    for (const bg of [HERITAGE_SAGE, FOREST_SAGE]) {
      assertAA("#fef3c7", bg, `amber ink on ${bg}`);
      assertAA(mixWithWhite(DUSTY_ROSE, 0.22), bg, `destructive ink on ${bg}`);
      assertAA(mixWithWhite(TAUPE_DARK, 0.22), bg, `warning ink on ${bg}`);
    }
  });

  it("staff notification CTA has a dark-mode ink (no inline dark-rose style)", () => {
    const bell = readFileSync(resolve("components/shell/notification-bell.tsx"), "utf8");
    assert.doesNotMatch(bell, /style=\{\{\s*color:\s*"#9B4F54"/i);
    assert.match(bell, /data-testid="notification-cta"[\s\S]{0,200}dark:text-\[color-mix\(in_oklch,var\(--dusty-rose\)_22%,var\(--true-white\)\)\]/);
    assert.ok((contrastRatio("#9B4F54", FOREST_SAGE) ?? 0) < 2, "old CTA ink was illegible on dark panel");
  });

  it("original light-mode ink was illegible in dark (regression anchor)", () => {
    assert.ok((contrastRatio("#92400e", HERITAGE_SAGE) ?? 0) < 2);
    assert.ok((contrastRatio(DUSTY_ROSE, HERITAGE_SAGE) ?? 0) < 4.5);
  });
});

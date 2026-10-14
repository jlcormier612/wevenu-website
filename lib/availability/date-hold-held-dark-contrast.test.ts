/**
 * HELD status label/icon dark-mode contrast on the Date hold bar.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const section = readFileSync(
  resolve("components/availability/date-holds-section.tsx"),
  "utf8",
);

describe("Date hold HELD dark-mode contrast", () => {
  it("uses warning-foreground in light mode and foreground in dark for label + icon", () => {
    const compact = section.slice(
      section.indexOf('data-testid="date-hold-active"'),
      section.indexOf('data-testid="date-hold-summary-date"'),
    );
    assert.match(compact, /Calendar className="[^"]*text-warning-foreground dark:text-foreground/);
    assert.match(
      compact,
      /text-xs font-semibold uppercase tracking-wide text-warning-foreground dark:text-foreground/,
    );
    assert.match(compact, />\s*Held\s*</);

    const regular = section.slice(
      section.indexOf('{/* Regular (non-compact) active holds */}'),
      section.indexOf('data-testid="date-hold-range-label"'),
    );
    assert.match(regular, /Calendar className="[^"]*text-warning-foreground dark:text-foreground/);
    assert.match(
      regular,
      /text-xs font-semibold uppercase tracking-wide text-warning-foreground dark:text-foreground/,
    );
  });

  it("does not change hold bar surface or action controls for contrast", () => {
    assert.match(
      section,
      /className="flex h-8 w-fit[^"]*border-warning\/30 bg-warning\/5[^"]*"\s*\n\s*data-testid="date-hold-active"/,
    );
    assert.doesNotMatch(section, /bg-warning\/5 dark:bg-/);
    assert.match(section, /data-testid="date-hold-edit"/);
    assert.match(section, /data-testid="date-hold-release"/);
    assert.match(section, /data-testid="date-hold-place"/);
  });
});

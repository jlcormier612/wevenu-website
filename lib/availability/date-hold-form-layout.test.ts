/**
 * Date Hold form: title full-width; dates side-by-side; times side-by-side.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const SECTION = readFileSync(
  resolve("components/availability/date-holds-section.tsx"),
  "utf8",
);

describe("Date Hold form layout", () => {
  it("orders title, then date grid, then time grid", () => {
    const formBlock = SECTION.slice(
      SECTION.indexOf("{/* Place hold / Place another hold"),
      SECTION.indexOf('data-testid="date-hold-spaces"') > 0
        ? SECTION.indexOf('data-testid="date-hold-spaces"')
        : SECTION.indexOf("Auto-release date"),
    );
    assert.match(formBlock, /Hold title/);
    assert.match(formBlock, /date-hold-hold-date/);
    assert.match(formBlock, /date-hold-end-date/);
    assert.match(formBlock, /date-hold-start-time/);
    assert.match(formBlock, /date-hold-end-time/);

    const titleIdx = formBlock.indexOf("Hold title");
    const firstGrid = formBlock.indexOf("grid gap-3 sm:grid-cols-2");
    const secondGrid = formBlock.indexOf(
      "grid gap-3 sm:grid-cols-2",
      firstGrid + 1,
    );
    const thirdGrid = formBlock.indexOf(
      "grid gap-3 sm:grid-cols-2",
      secondGrid + 1,
    );
    assert.ok(titleIdx >= 0 && firstGrid > titleIdx && secondGrid > firstGrid);
    assert.equal(thirdGrid, -1, "only two field grids expected");

    const dateGrid = formBlock.slice(firstGrid, secondGrid);
    assert.match(dateGrid, /date-hold-hold-date/);
    assert.match(dateGrid, /date-hold-end-date/);
    assert.doesNotMatch(dateGrid, /date-hold-start-time/);

    const timeGrid = formBlock.slice(secondGrid);
    assert.match(timeGrid, /date-hold-start-time/);
    assert.match(timeGrid, /date-hold-end-time/);
    assert.doesNotMatch(timeGrid, /date-hold-hold-date/);
  });
});

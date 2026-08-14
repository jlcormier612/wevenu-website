import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chunkFilmContactRows,
  filmContactRowWidthPercent,
  pickFilmContactColumns,
} from "@/lib/wedding-website/film-gallery-pack";

describe("pickFilmContactColumns", () => {
  it("uses a single-row fit for 1–3 photos", () => {
    assert.equal(pickFilmContactColumns(1), 1);
    assert.equal(pickFilmContactColumns(2), 2);
    assert.equal(pickFilmContactColumns(3), 3);
  });

  it("6 photos → 3 cols (exact divisor, classic sheet)", () => {
    assert.equal(pickFilmContactColumns(6), 3);
  });

  it("9 photos → 3 cols (exact 3×3 sheet)", () => {
    assert.equal(pickFilmContactColumns(9), 3);
  });

  it("4 photos → 2 cols (exact divisor)", () => {
    assert.equal(pickFilmContactColumns(4), 2);
  });

  it("7 photos → 3 cols (fewer rows than 2)", () => {
    // 3→3 rows rem 1; 2→4 rows rem 1 → prefer fewer rows → 3.
    assert.equal(pickFilmContactColumns(7), 3);
  });

  it("5 photos → 3 cols (fewer rows than 2)", () => {
    // 3→2 rows rem 2; 2→3 rows rem 1 → prefer fewer rows → 3.
    assert.equal(pickFilmContactColumns(5), 3);
  });

  it("never returns 4+ (film sheet stays 2–3)", () => {
    for (let n = 1; n <= 12; n++) {
      const cols = pickFilmContactColumns(n);
      assert.ok(cols <= 3, `n=${n} → ${cols}`);
    }
  });
});

describe("chunkFilmContactRows + width", () => {
  it("chunks 7 into 3+3+1 under 3 cols", () => {
    const rows = chunkFilmContactRows([0, 1, 2, 3, 4, 5, 6], 3);
    assert.deepEqual(rows, [[0, 1, 2], [3, 4, 5], [6]]);
    assert.equal(filmContactRowWidthPercent(3, 3), 100);
    assert.equal(filmContactRowWidthPercent(1, 3), 33.33);
  });

  it("full rows stay full width", () => {
    assert.equal(filmContactRowWidthPercent(3, 3), 100);
    assert.equal(filmContactRowWidthPercent(2, 2), 100);
  });
});

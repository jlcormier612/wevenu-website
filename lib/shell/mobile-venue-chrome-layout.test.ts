/**
 * Venue portal mobile chrome — header / tours / contracts must not overlap
 * or clip essential content at phone widths.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const header = readFileSync(resolve("components/shell/workspace-shell-header.tsx"), "utf8");
const switcher = readFileSync(resolve("components/shell/venue-switcher.tsx"), "utf8");
const tours = readFileSync(resolve("components/tours/tour-list.tsx"), "utf8");
const contracts = readFileSync(resolve("components/contracts/contract-list.tsx"), "utf8");

describe("venue portal mobile chrome layout", () => {
  it("header keeps logo recognizable and gives venue name a truncating flex slot", () => {
    assert.match(header, /max-w-\[7\.5rem\]/);
    assert.match(header, /min-w-0 flex-1 overflow-hidden/);
    assert.match(header, /shrink-0/);
    assert.match(header, /hidden sm:block/);
    assert.match(switcher, /max-w-\[9rem\].*sm:max-w-\[12rem\].*lg:max-w-\[16rem\]/s);
    assert.match(switcher, /min-w-0 truncate/);
  });

  it("tour rows stack actions below details on narrow screens", () => {
    assert.match(tours, /flex flex-col gap-3 sm:flex-row/);
    assert.match(tours, /flex flex-wrap items-center gap-2/);
    assert.match(tours, /break-all/);
  });

  it("contracts list uses mobile cards so event dates are not clipped", () => {
    assert.match(contracts, /sm:hidden/);
    assert.match(contracts, /whitespace-nowrap/);
    assert.match(contracts, /Event \{/);
    assert.match(contracts, /hidden sm:block overflow-x-auto/);
    assert.match(contracts, /min-w-\[36rem\]/);
  });
});

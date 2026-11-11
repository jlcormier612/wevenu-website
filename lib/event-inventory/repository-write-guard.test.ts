/**
 * Regression: Event Inventory status/collaboration writes must fail closed
 * when PostgREST returns ok with zero rows (RLS / wrong venue).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const repo = readFileSync(
  new URL("./repository.ts", import.meta.url),
  "utf8",
);

describe("event-inventory repository write guards", () => {
  it("setStatus selects updated ids and throws when zero rows return", () => {
    assert.match(repo, /export async function setStatus\(/);
    assert.match(repo, /\.select\("id"\)/);
    assert.match(repo, /Could not update Event Inventory status\./);
    assert.match(repo, /data\.length === 0/);
  });

  it("setCollaborationMode selects updated ids and throws when zero rows return", () => {
    assert.match(repo, /export async function setCollaborationMode\(/);
    assert.match(repo, /Could not update Event Inventory collaboration mode\./);
  });
});

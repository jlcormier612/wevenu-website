/**
 * New Request form must expose a visible Due date label (not placeholder-only).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("New Request Due date label", () => {
  const src = readFileSync(resolve("components/requests/request-manager.tsx"), "utf8");

  it("associates a Due date label with the date input", () => {
    assert.match(src, /htmlFor="request-due-date"/);
    assert.match(src, /id="request-due-date"/);
    assert.match(src, /Due date/);
    assert.match(src, /type="date"/);
    assert.match(src, /form\.dueDate/);
  });
});

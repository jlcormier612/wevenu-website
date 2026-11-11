import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("command palette search copy", () => {
  const source = readFileSync(resolve("components/shell/command-palette.tsx"), "utf8");

  it("describes only the entity types search actually locates", () => {
    assert.match(source, /placeholder="Search leads, clients, and vendors"/);
    assert.match(source, /Search across leads, clients, and vendors\./);
    assert.doesNotMatch(source, /events, vendors, guests/);
    assert.doesNotMatch(source, /documents, tasks, conversations/);
  });
});

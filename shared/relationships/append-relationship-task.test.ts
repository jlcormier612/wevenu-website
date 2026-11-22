import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appendRelationshipTask } from "./service";

describe("appendRelationshipTask", () => {
  it("rejects empty ids without throwing", async () => {
    const result = await appendRelationshipTask({
      id: "",
      relationshipId: "",
      title: "x",
      ownerId: "tm_jen",
      dueDate: "2026-11-22",
      priority: "medium",
      status: "open",
      createdAt: new Date().toISOString(),
    });
    assert.equal(result, null);
  });
});

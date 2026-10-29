/**
 * Resend rejects tag values with characters outside [A-Za-z0-9_-].
 * White Glove handoff uses synthetic relationship ids like `venue:{uuid}`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sendSrc = readFileSync(resolve("shared/email/send.ts"), "utf8");

describe("relationship email Resend tags", () => {
  it("sanitizes relationship id before tagging (venue:uuid safe)", () => {
    assert.ok(sendSrc.includes('input.relationshipId.replace(/[^a-zA-Z0-9_-]/g, "")'));
    assert.ok(sendSrc.includes("Synthetic WG ids"));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatAccessBadge,
  summarizeWhatPersonCan,
} from "@/lib/authorization/access-copy";

describe("customer-facing access copy", () => {
  it("formats Administrator · Owner badge", () => {
    assert.equal(formatAccessBadge("administrator", true), "Administrator · Owner");
    assert.equal(formatAccessBadge("administrator", false), "Administrator");
  });

  it("summarizes plain-English capabilities without raw keys", () => {
    const lines = summarizeWhatPersonCan({
      isActive: true,
      isOwner: false,
      accessTitle: "administrator",
      overrides: { "account.billing": true },
    });
    assert.ok(lines.includes("Manage clients"));
    assert.ok(lines.includes("Manage billing"));
    assert.ok(lines.includes("Manage team members"));
    assert.ok(!lines.some((l) => l.includes(".")));
  });

  it("includes ownership control only for Owners", () => {
    const owner = summarizeWhatPersonCan({
      isActive: true,
      isOwner: true,
      accessTitle: "administrator",
    });
    assert.ok(owner.includes("Control ownership and Owners"));
    const admin = summarizeWhatPersonCan({
      isActive: true,
      isOwner: false,
      accessTitle: "administrator",
    });
    assert.ok(!admin.includes("Control ownership and Owners"));
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  customerFacingJournalEntries,
  customerFacingLatestJournalEntry,
} from "@/lib/portal/customer-facing-journal";
import { countUnreadVenueMessages } from "@/lib/portal/unread-messages";

describe("customer-facing journal", () => {
  it("keeps manual entries and drops auto Luv memories", () => {
    const manual = { source: "manual" as const };
    const auto = { source: "auto" as const };
    assert.deepEqual(customerFacingJournalEntries([auto, manual]), [manual]);
    assert.equal(customerFacingLatestJournalEntry(auto), null);
    assert.equal(customerFacingLatestJournalEntry(manual), manual);
  });
});

describe("portal unread venue messages", () => {
  it("counts only unread venue bubbles", () => {
    assert.equal(countUnreadVenueMessages([
      { sender_type: "venue", couple_read_at: null },
      { sender_type: "venue", couple_read_at: "2026-09-14T00:00:00Z" },
      { sender_type: "couple", couple_read_at: null },
    ]), 1);
  });
});

describe("public wedding website does not render Luv noticed", () => {
  it("wedding-website renderer has no Luv-noticed journal chrome", () => {
    const src = readFileSync(resolve("components/wedding-website/wedding-website.tsx"), "utf8");
    assert.doesNotMatch(src, /Luv noticed/);
    assert.doesNotMatch(src, /couple_journal/);
  });
});

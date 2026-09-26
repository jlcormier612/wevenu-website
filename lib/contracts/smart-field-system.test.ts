/**
 * Contract Smart Field system — inventory + always-resolve invariant.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFERRED_MERGE_FIELD_KEYS, MERGE_FIELDS } from "@/lib/contracts/constants";
import {
  buildMergeData,
  extractTokens,
  mergeContent,
  mergeDataCoversPickerFields,
  requiredMergeFieldKeys,
} from "@/lib/contracts/merge";
import {
  MISSING_BALANCE_REMAINING,
  MISSING_CONTRACT_TOTAL,
  MISSING_EVENT_SPACES,
  MISSING_PAYMENT_SCHEDULE,
  MISSING_VENUE_ACCESS_HOURS,
} from "@/lib/contracts/merge-fallbacks";
import { WEDDING_VENUE_AGREEMENT_CONTENT } from "@/lib/contracts/starters";

describe("Contract Smart Field system — picker promise", () => {
  it("every MERGE_FIELDS key always resolves (never omitted)", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: null,
      eventType: null,
      guestCount: null,
      contractTitle: "Agreement",
      // Intentionally omit optional sources — fallbacks must still fill every key.
    });
    assert.equal(mergeDataCoversPickerFields(data), true);
    for (const key of requiredMergeFieldKeys()) {
      assert.equal(typeof data[key], "string", key);
      assert.ok(data[key]!.length > 0, key);
    }
  });

  it("missing event_spaces uses honest fallback — never leaves raw {{event_spaces}}", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: "2027-10-24",
      eventType: "wedding",
      guestCount: 100,
      contractTitle: "Agreement",
      eventSpaces: null,
    });
    assert.equal(data.event_spaces, MISSING_EVENT_SPACES);
    const body = mergeContent(
      "Event Spaces: {{event_spaces}}\n\nAlso {{event_spaces}}",
      data,
    );
    assert.doesNotMatch(body, /\{\{event_spaces\}\}/);
    assert.doesNotMatch(body, /\{\{/);
    assert.match(body, /No event spaces are listed on this booking yet/);
  });

  it("real event_spaces label resolves when provided", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: "2027-10-24",
      eventType: "wedding",
      guestCount: 100,
      contractTitle: "Agreement",
      eventSpaces: "Barn",
    });
    assert.equal(data.event_spaces, "Barn");
    assert.equal(mergeContent("Spaces: {{event_spaces}}", data), "Spaces: Barn");
  });

  it("payment fields stay honest — no invented schedule or balance", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: "2027-10-24",
      eventType: "wedding",
      guestCount: 100,
      contractTitle: "Agreement",
      contractTotal: "$12,000.00",
      // No payment schedule / balance source.
    });
    assert.equal(data.payment_schedule_summary, MISSING_PAYMENT_SCHEDULE);
    assert.equal(data.balance_remaining, MISSING_BALANCE_REMAINING);
    assert.equal(data.contract_total, "$12,000.00");
    assert.equal(data.venue_access_hours, MISSING_VENUE_ACCESS_HOURS);
  });

  it("default starter tokens are only supported MERGE_FIELDS keys", () => {
    const supported = new Set(MERGE_FIELDS.map((f) => f.key));
    const tokens = extractTokens(WEDDING_VENUE_AGREEMENT_CONTENT);
    assert.ok(tokens.length > 0);
    for (const t of tokens) {
      assert.ok(supported.has(t), `unsupported starter token {{${t}}}`);
      assert.ok(!(DEFERRED_MERGE_FIELD_KEYS as readonly string[]).includes(t), t);
    }
  });

  it("merging the starter with empty sources leaves no raw tokens", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: null,
      eventType: null,
      guestCount: null,
      contractTitle: "Venue Rental Agreement",
    });
    // Strip policy placeholders so safety focuses on tokens.
    const authored = WEDDING_VENUE_AGREEMENT_CONTENT.replace(
      /Add your venue's approved[^\n.]*\./g,
      "Venue-approved policy language.",
    );
    const merged = mergeContent(authored, data);
    assert.doesNotMatch(merged, /\{\{/);
    assert.doesNotMatch(merged, /\{\{event_spaces\}\}/);
    assert.match(merged, /No event spaces are listed on this booking yet/);
    assert.match(merged, /No payment schedule is on file/);
    assert.match(merged, /Total contracted amount is not listed yet|See payment|\$/);
    // When no total source: MISSING_CONTRACT_TOTAL
    assert.match(merged, new RegExp(MISSING_CONTRACT_TOTAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("vendors_on_file stays deferred — not in the picker", () => {
    assert.equal(MERGE_FIELDS.some((f) => f.key === "vendors_on_file"), false);
    assert.ok((DEFERRED_MERGE_FIELD_KEYS as readonly string[]).includes("vendors_on_file"));
  });
});

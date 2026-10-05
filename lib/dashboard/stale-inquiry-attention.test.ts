import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  hasProgressedPastEarlyInquiry,
  qualifiesAsStaleNewInquiryAttention,
} from "@/lib/dashboard/stale-inquiry-attention";

const TODAY = "2026-10-04";
const TWO_DAYS_AGO_MS = Date.parse("2026-10-02T12:00:00.000Z");
const GOLDI_CREATED = "2026-09-23T12:00:00.000Z";

function goldiLead(overrides: {
  salesStage?: string;
  followUpDate?: string | null;
  createdAt?: string;
} = {}) {
  return {
    salesStage: overrides.salesStage ?? "new_inquiry",
    followUpDate: overrides.followUpDate === undefined ? null : overrides.followUpDate,
    createdAt: overrides.createdAt ?? GOLDI_CREATED,
  };
}

describe("Today's Focus stale-inquiry eligibility", () => {
  it("genuine new inquiry with no follow-up still qualifies", () => {
    assert.equal(
      qualifiesAsStaleNewInquiryAttention(goldiLead(), {}, TODAY, TWO_DAYS_AGO_MS),
      true,
    );
  });

  it("Goldi: sales_stage new_inquiry + fully executed contract is not a new inquiry", () => {
    const facts = {
      firstBookedAt: null,
      lostAt: null,
      contractStatus: "signed",
      venueSigned: true,
      requiredClientTotal: 1,
      requiredClientSigned: 1,
    };
    assert.equal(hasProgressedPastEarlyInquiry(facts), true);
    assert.equal(
      qualifiesAsStaleNewInquiryAttention(goldiLead(), facts, TODAY, TWO_DAYS_AGO_MS),
      false,
    );
  });

  it("sales_stage alone cannot manufacture the new-inquiry claim once a contract exists", () => {
    assert.equal(
      qualifiesAsStaleNewInquiryAttention(
        goldiLead({ salesStage: "new_inquiry" }),
        { contractStatus: "sent" },
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      false,
    );
  });

  it("booked and lost authoritative stamps suppress the claim", () => {
    assert.equal(
      qualifiesAsStaleNewInquiryAttention(
        goldiLead(),
        { firstBookedAt: "2026-09-30T12:00:00.000Z" },
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      false,
    );
    assert.equal(
      qualifiesAsStaleNewInquiryAttention(
        goldiLead(),
        { lostAt: "2026-09-30T12:00:00.000Z" },
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      false,
    );
  });

  it("payment outstanding is not consulted; contract-executed still suppresses", () => {
    assert.equal(
      qualifiesAsStaleNewInquiryAttention(
        goldiLead(),
        { contractStatus: "signed" },
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      false,
    );
  });

  it("overdue follow-up is not this pattern (separate Focus row)", () => {
    assert.equal(
      qualifiesAsStaleNewInquiryAttention(
        goldiLead({ followUpDate: "2026-10-01" }),
        {},
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      false,
    );
  });

  it("fresh inquiry within 48h does not qualify", () => {
    assert.equal(
      qualifiesAsStaleNewInquiryAttention(
        goldiLead({ createdAt: "2026-10-04T00:00:00.000Z" }),
        {},
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      false,
    );
  });

  it("Dashboard Focus CTA targets the lead conversation tab", () => {
    const engine = readFileSync(resolve("lib/dashboard-system/decision-engine.ts"), "utf8");
    assert.match(engine, /href: `\/leads\/\$\{lead\.id\}\?tab=messages`/);
    assert.match(engine, /rightLabel: "Follow up"/);
    const row = readFileSync(resolve("components/dashboard-system/focus-attention-row.tsx"), "utf8");
    assert.match(row, /data-testid="todays-focus-item-link"/);
    assert.match(row, /href=\{item\.href\}/);
    assert.doesNotMatch(row, /preventDefault/);
  });

  it("does not send customer communication or write notes from Focus dismiss/CTA", () => {
    const row = readFileSync(resolve("components/dashboard-system/focus-attention-row.tsx"), "utf8");
    assert.doesNotMatch(row, /sendMessage|createNote|markContacted/);
    const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
    assert.match(service, /qualifiesAsStaleNewInquiryAttention/);
    assert.match(service, /from\("clients"\)/);
    assert.match(service, /from\("contracts"\)/);
    assert.doesNotMatch(service, /from\("messages"\)\.insert/);
  });
});

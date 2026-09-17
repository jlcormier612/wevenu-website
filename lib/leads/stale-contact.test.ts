/**
 * Focused tests for stale-contact opportunity age.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isStaleWithoutContact,
  opportunityContactReferenceAt,
  STALE_CONTACT_DAYS,
} from "@/lib/leads/stale-contact";

const NOW = Date.parse("2026-09-17T17:00:00.000Z");

describe("stale-contact opportunity age", () => {
  it("does not treat a brand-new lead with null last_contacted_at as stale", () => {
    const lead = {
      lastContactedAt: null,
      inquiryDate: "2026-09-17",
      createdAt: "2026-09-17T16:55:00.000Z",
    };
    assert.equal(isStaleWithoutContact(lead, NOW), false);
  });

  it("treats an old never-contacted lead as stale using created/inquiry age", () => {
    const lead = {
      lastContactedAt: null,
      inquiryDate: "2026-08-01",
      createdAt: "2026-08-01T12:00:00.000Z",
    };
    assert.equal(isStaleWithoutContact(lead, NOW), true);
  });

  it("uses last_contacted_at when present", () => {
    const recent = {
      lastContactedAt: "2026-09-15T12:00:00.000Z",
      inquiryDate: "2026-01-01",
      createdAt: "2026-01-01T12:00:00.000Z",
    };
    assert.equal(isStaleWithoutContact(recent, NOW), false);

    const old = {
      lastContactedAt: "2026-09-01T12:00:00.000Z",
      inquiryDate: "2026-01-01",
      createdAt: "2026-01-01T12:00:00.000Z",
    };
    assert.equal(isStaleWithoutContact(old, NOW), true);
  });

  it("prefers last contact over inquiry/created for the reference instant", () => {
    const ref = opportunityContactReferenceAt({
      lastContactedAt: "2026-09-10T00:00:00.000Z",
      inquiryDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(ref.toISOString(), "2026-09-10T00:00:00.000Z");
  });

  it("documents the 7-day threshold", () => {
    assert.equal(STALE_CONTACT_DAYS, 7);
  });
});

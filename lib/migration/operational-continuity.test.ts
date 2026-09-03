import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateGuestListEntry } from "@/lib/migration/operational-guest";
import { validateEventVendorAssignment } from "@/lib/migration/event-vendor-assignment";
import {
  shouldImportOperationalTimeline,
  TIMELINE_PROXIMITY_DAYS,
  validateTimelineEntry,
} from "@/lib/migration/operational-timeline";
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";

describe("operational guest list normalize + validate", () => {
  it("normalizes a guest row for an active Event", () => {
    const result = genericCsvAdapter.normalizeRow({
      clientEmail: "smith@example.com",
      eventDate: "2026-10-17",
      firstName: "Jordan",
      lastName: "Lee",
      guestEmail: "jordan@example.com",
      household: "Lee",
      rsvpStatus: "attending",
      sourceId: "g-1",
    }, "guest_list");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.normalized.firstName, "Jordan");
    assert.equal(result.normalized.email, "jordan@example.com");
    assert.equal(result.normalized.clientEmail, "smith@example.com");
  });

  it("rejects missing first name", () => {
    assert.match(validateGuestListEntry({
      firstName: "",
      clientEmail: "a@b.com",
      eventDate: "2026-10-17",
    }) ?? "", /first name/i);
  });
});

describe("event vendor assignment normalize + validate", () => {
  it("normalizes photographer assignment", () => {
    const result = genericCsvAdapter.normalizeRow({
      clientEmail: "smith@example.com",
      eventDate: "2026-10-17",
      vendorBusinessName: "Lens & Light",
      category: "photographer",
      arrivalTime: "14:00",
      sourceId: "va-photo",
    }, "event_vendor_assignment");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.normalized.vendorBusinessName, "Lens & Light");
  });

  it("requires vendor identity", () => {
    assert.match(validateEventVendorAssignment({
      clientEmail: "a@b.com",
      eventDate: "2026-10-17",
    }) ?? "", /vendor/i);
  });
});

describe("timeline proximity rule", () => {
  it(`imports within ${TIMELINE_PROXIMITY_DAYS} days`, () => {
    const d = shouldImportOperationalTimeline({
      eventDate: "2026-09-20",
      today: "2026-09-03",
    });
    assert.equal(d.import, true);
    assert.equal(d.reason, "within_proximity");
  });

  it("skips far-future non-finalized timelines", () => {
    const d = shouldImportOperationalTimeline({
      eventDate: "2026-12-01",
      today: "2026-09-03",
    });
    assert.equal(d.import, false);
  });

  it("imports when finalized even if far", () => {
    const d = shouldImportOperationalTimeline({
      eventDate: "2026-12-01",
      today: "2026-09-03",
      timelineFinalized: true,
    });
    assert.equal(d.import, true);
    assert.equal(d.reason, "finalized");
  });

  it("imports when forceImport is set", () => {
    const d = shouldImportOperationalTimeline({
      eventDate: "2026-12-01",
      today: "2026-09-03",
      forceImport: true,
    });
    assert.equal(d.import, true);
    assert.equal(d.reason, "forced");
  });

  it("normalizes a timeline CSV row", () => {
    const result = genericCsvAdapter.normalizeRow({
      clientEmail: "smith@example.com",
      eventDate: "2026-10-17",
      title: "Ceremony",
      entryTime: "16:00",
      timelineFinalized: "yes",
    }, "timeline_entry");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.normalized.timelineFinalized, true);
    assert.equal(validateTimelineEntry(result.normalized as never), null);
  });
});

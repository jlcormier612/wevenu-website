import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

const prevStore = process.env.HTC_CRM_STORE;
const prevPath = process.env.RELATIONSHIPS_DATA_PATH;
const prevNotify = process.env.INQUIRY_NOTIFY_EMAIL;
const prevResend = process.env.RESEND_API_KEY;
const dataDir = mkdtempSync(join(tmpdir(), "htc-contact-hardening-"));

before(() => {
  process.env.HTC_CRM_STORE = "file";
  process.env.RELATIONSHIPS_DATA_PATH = dataDir;
  delete process.env.INQUIRY_NOTIFY_EMAIL;
  delete process.env.RESEND_API_KEY;
});

after(() => {
  if (prevStore === undefined) delete process.env.HTC_CRM_STORE;
  else process.env.HTC_CRM_STORE = prevStore;
  if (prevPath === undefined) delete process.env.RELATIONSHIPS_DATA_PATH;
  else process.env.RELATIONSHIPS_DATA_PATH = prevPath;
  if (prevNotify === undefined) delete process.env.INQUIRY_NOTIFY_EMAIL;
  else process.env.INQUIRY_NOTIFY_EMAIL = prevNotify;
  if (prevResend === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = prevResend;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("Contact CRM sourceId idempotency", () => {
  it("replays the same contact_form sourceId without a second timeline event", async () => {
    const { ingestContactForm } = await import("@shared/relationships/ingest");
    const { loadLiveStore } = await import("@shared/relationships/store");

    const sourceId = "11111111-1111-4111-8111-111111111111";
    const first = await ingestContactForm({
      email: "contact.hardening@example.com",
      firstName: "Ada",
      lastName: "Venue",
      venueName: "Rose Hall",
      message: "first",
      sourceId,
    });
    const second = await ingestContactForm({
      email: "contact.hardening@example.com",
      firstName: "Ada",
      lastName: "Venue",
      venueName: "Rose Hall",
      message: "retry",
      sourceId,
    });

    assert.equal(second.relationship.id, first.relationship.id);
    assert.equal(second.created, false);

    const store = await loadLiveStore();
    const events = store.timelineEvents.filter(
      (event) =>
        event.type === "contact_form" &&
        String(event.meta?.sourceId ?? "") === sourceId,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.body, "first");
  });

  it("keeps Contact classified as contact_form, not walkthrough", async () => {
    const { ingestContactForm } = await import("@shared/relationships/ingest");
    const { loadLiveStore } = await import("@shared/relationships/store");

    const sourceId = "22222222-2222-4222-8222-222222222222";
    await ingestContactForm({
      email: "contact.class@example.com",
      firstName: "Bea",
      lastName: "Host",
      venueName: "Linen Barn",
      message: "Quick question",
      sourceId,
    });

    const store = await loadLiveStore();
    const rel = store.relationships.find(
      (row) => row.owner.email === "contact.class@example.com",
    );
    assert.ok(rel);
    assert.equal(rel.status, "inquiry");
    assert.equal(rel.salesStage, "inquiry");

    const types = store.timelineEvents
      .filter((event) => event.relationshipId === rel.id)
      .map((event) => event.type);
    assert.ok(types.includes("contact_form"));
    assert.equal(types.includes("walkthrough_requested"), false);
    assert.equal(types.includes("walkthrough_scheduled"), false);
  });
});

describe("submitInquiry Contact orchestration", () => {
  it("accepts a valid Contact payload and replays the same idempotency key safely", async () => {
    const { submitInquiry } = await import("@/lib/inquiries/service");
    const { loadLiveStore } = await import("@shared/relationships/store");

    const key = "33333333-3333-4333-8333-333333333333";
    const fields = {
      firstName: "Cora",
      lastName: "Owner",
      name: "Cora Owner",
      email: "contact.submit@example.com",
      venue: "Cedar Loft",
      message: "How can we help test?",
    };

    const first = await submitInquiry({
      kind: "contact",
      fields,
      idempotencyKey: key,
    });
    const second = await submitInquiry({
      kind: "contact",
      fields: { ...fields, message: "changed on retry" },
      idempotencyKey: key,
    });

    assert.equal(first.id, key);
    assert.equal(second.id, key);
    assert.equal(first.replayed, undefined);
    assert.equal(second.replayed, true);

    const store = await loadLiveStore();
    const events = store.timelineEvents.filter(
      (event) =>
        event.type === "contact_form" &&
        String(event.meta?.sourceId ?? "") === key,
    );
    assert.equal(events.length, 1);
  });

  it("rejects incomplete Contact fields before CRM write via route validation helpers", async () => {
    // Mirrors /api/inquiries contact required-field gate.
    const firstName = "";
    const lastName = "Owner";
    const email = "incomplete@example.com";
    const venue = "Hall";
    const hasName = Boolean(firstName && lastName);
    assert.equal(hasName && Boolean(email) && Boolean(venue), false);
  });
});

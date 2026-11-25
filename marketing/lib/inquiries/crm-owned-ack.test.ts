import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

/**
 * Regression: marketing must not send independent visitor acknowledgments.
 * CRM Program 3 owns configurable business communications.
 */

const prevStore = process.env.HTC_CRM_STORE;
const prevPath = process.env.RELATIONSHIPS_DATA_PATH;
const prevNotify = process.env.INQUIRY_NOTIFY_EMAIL;
const prevResend = process.env.RESEND_API_KEY;
const dataDir = mkdtempSync(join(tmpdir(), "htc-crm-owned-ack-"));

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

describe("CRM-owned inquiry acknowledgments", () => {
  it("does not import or call hardcoded inquiry/feedback confirmation sends", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const servicePath = fileURLToPath(
      new URL("./service.ts", import.meta.url),
    );
    const source = readFileSync(servicePath, "utf8");
    assert.equal(
      source.includes("sendInquiryConfirmationEmail"),
      false,
      "marketing inquiry path must not call sendInquiryConfirmationEmail",
    );
    assert.equal(
      source.includes("sendFeedbackConfirmationEmail"),
      false,
      "marketing inquiry path must not call sendFeedbackConfirmationEmail",
    );
    assert.equal(
      source.includes("shouldSendInquiryConfirmation"),
      false,
      "hardcoded confirmation gate must be removed",
    );
  });

  it("creates CRM relationship for contact without requiring a visitor ack send", async () => {
    const { submitInquiry } = await import("./service");
    const { loadLiveStore } = await import("@shared/relationships/store");

    const result = await submitInquiry({
      kind: "contact",
      fields: {
        firstName: "Crm",
        lastName: "Ack",
        email: "crm.owned.ack@example.com",
        venue: "Ack Test Hall",
        message: "Stage 4C ownership probe — disposable",
      },
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    assert.ok(result.id);
    assert.equal(result.kind, "contact");
    assert.equal(result.replayed, undefined);

    const store = await loadLiveStore();
    const rel = store.relationships.find(
      (r) => r.owner.email === "crm.owned.ack@example.com",
    );
    assert.ok(rel, "contact must create a CRM relationship");
    assert.equal(rel.status, "inquiry");
  });
});

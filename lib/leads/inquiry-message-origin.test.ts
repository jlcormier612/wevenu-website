import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  customerFacingInquiryMessage,
  inquiryMessageDisplayLabel,
  normalizeInquiryMessageOrigin,
  originAfterStaffEdit,
  originForWritePath,
} from "@/lib/leads/inquiry-message-origin";

describe("write-path origin classification", () => {
  it("classifies manual New Lead as venue-originated", () => {
    assert.equal(originForWritePath("manual_new_lead"), "venue");
  });

  it("classifies public customer inquiry as customer-originated", () => {
    assert.equal(originForWritePath("public_inquire"), "customer");
    assert.equal(originForWritePath("public_form"), "customer");
    assert.equal(originForWritePath("email_intake"), "customer");
    assert.equal(originForWritePath("tour_book"), "customer");
    assert.equal(originForWritePath("facebook_webhook"), "customer");
  });

  it("classifies import and legacy as unknown — never guessed as customer", () => {
    assert.equal(originForWritePath("import"), "unknown");
    assert.equal(originForWritePath("legacy"), "unknown");
    assert.equal(normalizeInquiryMessageOrigin(null), "unknown");
    assert.equal(normalizeInquiryMessageOrigin("website"), "unknown");
    assert.equal(normalizeInquiryMessageOrigin("direct"), "unknown");
  });
});

describe("customer-facing Luv eligibility", () => {
  const SENSITIVE = "SSN-CANARY-7741 credit hold";
  const INNOCUOUS = "Called back Tuesday; seems lovely.";
  const USEFUL = "We love the garden and want a Saturday in August.";

  it("excludes venue-originated content from Luv context", () => {
    assert.equal(customerFacingInquiryMessage(SENSITIVE, "venue"), null);
    assert.equal(customerFacingInquiryMessage(INNOCUOUS, "venue"), null);
  });

  it("excludes unknown/legacy content from Luv context", () => {
    assert.equal(customerFacingInquiryMessage(USEFUL, "unknown"), null);
    assert.equal(customerFacingInquiryMessage(USEFUL, null), null);
    assert.equal(customerFacingInquiryMessage(USEFUL, undefined), null);
  });

  it("allows known customer-originated content into eligible context", () => {
    assert.equal(customerFacingInquiryMessage(USEFUL, "customer"), USEFUL);
  });
});

describe("staff edit does not upgrade unknown to customer", () => {
  it("keeps origin when the text is unchanged", () => {
    assert.equal(
      originAfterStaffEdit({
        previousMessage: "Garden terrace",
        nextMessage: "Garden terrace",
        previousOrigin: "customer",
      }),
      "customer",
    );
    assert.equal(
      originAfterStaffEdit({
        previousMessage: "Called Tuesday",
        nextMessage: "Called Tuesday",
        previousOrigin: "unknown",
      }),
      "unknown",
    );
  });

  it("marks changed text as venue-authored", () => {
    assert.equal(
      originAfterStaffEdit({
        previousMessage: "Garden terrace",
        nextMessage: "Staff added a budget note",
        previousOrigin: "customer",
      }),
      "venue",
    );
  });
});

describe("Lead Overview display follows verified provenance", () => {
  it("does not label unknown or venue text as the original inquiry", () => {
    assert.equal(inquiryMessageDisplayLabel("customer"), "Original inquiry");
    assert.equal(inquiryMessageDisplayLabel("venue"), "Internal notes");
    assert.equal(inquiryMessageDisplayLabel("unknown"), "Notes");
    assert.notEqual(inquiryMessageDisplayLabel("unknown"), "Original inquiry");
    assert.notEqual(inquiryMessageDisplayLabel("venue"), "Inquiry message");
  });
});

describe("write paths persist inquiryMessageOrigin", () => {
  it("manual createLead writes venue or unknown — never customer from the form", () => {
    const svc = readFileSync(resolve("lib/leads/service.ts"), "utf8");
    assert.match(svc, /originForWritePath\("manual_new_lead"\)/);
    assert.match(svc, /originForWritePath\("import"\)/);
    assert.match(svc, /originAfterStaffEdit/);
  });

  it("public inquire / form RPCs pass customer origin", () => {
    const sql = readFileSync(resolve("supabase/migrations/20261410200000_lead_inquiry_message_origin.sql"), "utf8");
    assert.match(sql, /inquiry_message_origin/);
    assert.match(sql, /inquiryMessageOrigin/);
    assert.match(sql, /'inquiryMessageOrigin', 'customer'/);
    assert.match(sql, /v_origin := 'unknown'/);
  });

  it("email and Facebook ingest payloads set customer origin", () => {
    const email = readFileSync(resolve("app/api/leads/email-intake/route.ts"), "utf8");
    assert.match(email, /inquiryMessageOrigin: "customer"/);
    const fb = readFileSync(resolve("lib/facebook/processor.ts"), "utf8");
    assert.match(fb, /inquiryMessageOrigin: "customer"/);
  });
});

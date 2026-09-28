/**
 * Lead Contact SMS evidence attribution — form consent must not bleed across leads.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  smsPermissionAttributedToLead,
} from "@/lib/communication/contact-permission-view";
import {
  shouldRecordInquirySmsConsent,
} from "@/lib/communication/apply-inquiry-consent";
import {
  SMS_PERMISSION_SOURCE_INQUIRY_FORM,
  SMS_PERMISSION_SOURCE_TOUR_FORM,
} from "@/lib/communication/sms-consent";

describe("smsPermissionAttributedToLead", () => {
  const betty = { leadId: "betty-id", relationshipId: "betty-rel" };
  const rebeccaForm = {
    status: "opted_in" as const,
    source: SMS_PERMISSION_SOURCE_INQUIRY_FORM,
    updatedAt: "2026-09-26T03:13:16.406Z",
    consentText: "Yes…",
    relationshipId: "rebecca-rel",
    evidenceLeadId: "rebecca-id",
  };

  it("does not attribute another lead's website inquiry consent to a manual lead", () => {
    assert.equal(smsPermissionAttributedToLead(rebeccaForm, betty), false);
  });

  it("attributes form consent when evidence.leadId matches", () => {
    assert.equal(
      smsPermissionAttributedToLead(rebeccaForm, {
        leadId: "rebecca-id",
        relationshipId: "other-rel",
      }),
      true,
    );
  });

  it("attributes form consent when relationship_id matches", () => {
    assert.equal(
      smsPermissionAttributedToLead(
        { ...rebeccaForm, evidenceLeadId: "other-lead", relationshipId: "betty-rel" },
        betty,
      ),
      true,
    );
  });

  it("always surfaces opted_out / provider_blocked for the phone", () => {
    assert.equal(
      smsPermissionAttributedToLead(
        { ...rebeccaForm, status: "opted_out", source: "twilio_stop" },
        betty,
      ),
      true,
    );
    assert.equal(
      smsPermissionAttributedToLead(
        { ...rebeccaForm, status: "provider_blocked", source: "twilio_21610" },
        betty,
      ),
      true,
    );
  });

  it("keeps START / email opt-in as number-level for any lead with that phone", () => {
    assert.equal(
      smsPermissionAttributedToLead(
        {
          status: "opted_in",
          source: "twilio_start",
          updatedAt: null,
          consentText: null,
          relationshipId: null,
          evidenceLeadId: null,
        },
        betty,
      ),
      true,
    );
    assert.equal(
      smsPermissionAttributedToLead(
        {
          status: "opted_in",
          source: "email_sms_consent",
          updatedAt: null,
          consentText: null,
          relationshipId: null,
          evidenceLeadId: null,
        },
        betty,
      ),
      true,
    );
  });

  it("treats tour_form like inquiry_form for attribution", () => {
    assert.equal(
      smsPermissionAttributedToLead(
        { ...rebeccaForm, source: SMS_PERMISSION_SOURCE_TOUR_FORM },
        betty,
      ),
      false,
    );
  });
});

describe("manual vs inquiry capture", () => {
  it("phone alone is never inquiry SMS consent", () => {
    assert.equal(shouldRecordInquirySmsConsent(false, "5085551234"), false);
    assert.equal(shouldRecordInquirySmsConsent(true, ""), false);
    assert.equal(shouldRecordInquirySmsConsent(true, "5085551234"), true);
  });

  it("manual lead create path does not call applyInquiryCommunicationCapture", () => {
    const core = readFileSync(resolve("lib/leads/service.ts"), "utf8");
    const slice = core.slice(core.indexOf("async function createLeadCore"), core.indexOf("export async function createLead"));
    assert.doesNotMatch(slice, /applyInquiryCommunicationCapture/);
  });

  it("lead detail passes leadId into SMS evidence lookup", () => {
    const page = readFileSync(resolve("app/(app)/leads/[id]/page.tsx"), "utf8");
    assert.match(page, /getSmsPermissionEvidenceForContact\(\{[\s\S]*leadId:\s*lead\.id/);
  });

  it("lead_created automations cannot advance pipeline stage", () => {
    const svc = readFileSync(resolve("lib/message-sequences/service.ts"), "utf8");
    assert.match(svc, /if \(triggerType === "lead_created"\) return;/);
  });
});

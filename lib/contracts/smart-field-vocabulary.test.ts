/**
 * Supported Smart Field vocabulary — contracts + message templates.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  DEFERRED_MERGE_FIELD_KEYS,
  MERGE_FIELDS,
  REMOVED_MERGE_FIELD_KEYS,
} from "@/lib/contracts/constants";
import { buildMergeData as buildContractMergeData } from "@/lib/contracts/merge";
import { WEDDING_VENUE_AGREEMENT_CONTENT } from "@/lib/contracts/starters";
import { contractTemplatePreviewMergeData } from "@/lib/contracts/preview";
import { MESSAGE_MERGE_FIELDS } from "@/lib/message-templates/constants";
import { buildMergeData as buildMessageMergeData } from "@/lib/message-templates/merge";
import { STARTER_MESSAGE_MASTERS } from "@/lib/message-templates/starters";
import { SAMPLE_MERGE_VALUES } from "@/lib/message-templates/preview";
import { extractTokens } from "@/lib/shared-merge/tokens";

const REMOVED = [
  "couple_name",
  "partner_name",
  "full_name",
  "primary_contact_name",
  "partner_first_name",
  "partner_last_name",
  "partner_full_name",
] as const;

const APPROVED_CONTRACT_KEYS = [
  "venue_name",
  "venue_address",
  "venue_phone",
  "venue_email",
  "client_name",
  "first_name",
  "last_name",
  "client_email",
  "client_phone",
  "event_name",
  "event_date",
  "event_type",
  "guest_count",
  "today_date",
  "contract_title",
] as const;

describe("supported Smart Field registries", () => {
  it("does not list couple_name, partner_name, or duplicate customer-name fields", () => {
    const contractKeys = MERGE_FIELDS.map((f) => f.key);
    const messageKeys = MESSAGE_MERGE_FIELDS.map((f) => f.key);
    for (const key of REMOVED) {
      assert.ok(!contractKeys.includes(key), `contract registry still has ${key}`);
      assert.ok(!messageKeys.includes(key), `message registry still has ${key}`);
    }
    assert.equal(contractKeys.filter((k) => k === "client_name").length, 1);
    assert.equal(messageKeys.filter((k) => k === "client_name").length, 1);
  });

  it("keeps one canonical customer-name field: client_name", () => {
    const client = MERGE_FIELDS.find((f) => f.key === "client_name");
    assert.ok(client);
    assert.match(client!.description, /required client signer/i);
    const message = MESSAGE_MERGE_FIELDS.find((f) => f.key === "client_name");
    assert.ok(message);
    assert.match(message!.description, /Primary client contact/i);
  });

  it("contract picker is exactly the approved catalog", () => {
    const keys = MERGE_FIELDS.map((f) => f.key);
    assert.deepEqual(keys, [...APPROVED_CONTRACT_KEYS]);
    for (const deferred of DEFERRED_MERGE_FIELD_KEYS) {
      assert.ok(!keys.includes(deferred), deferred);
    }
    for (const removed of REMOVED_MERGE_FIELD_KEYS) {
      assert.ok(!keys.includes(removed), `picker still advertises ${removed}`);
    }
  });

  it("picker and MERGE_FIELDS cannot drift from REMOVED list", () => {
    const keys = new Set(MERGE_FIELDS.map((f) => f.key));
    for (const removed of REMOVED_MERGE_FIELD_KEYS) {
      assert.ok(!keys.has(removed), removed);
    }
  });
});

describe("starter / default templates", () => {
  it("contract starter does not contain removed tokens", () => {
    for (const key of REMOVED) {
      assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, new RegExp(`\\{\\{${key}\\}\\}`));
    }
    for (const key of REMOVED_MERGE_FIELD_KEYS) {
      assert.doesNotMatch(
        WEDDING_VENUE_AGREEMENT_CONTENT,
        new RegExp(`\\{\\{${key}\\}\\}`),
        `starter still has {{${key}}}`,
      );
    }
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{client_name\}\}/);
  });

  it("contract starter tokens are a subset of the approved picker catalog", () => {
    const tokens = extractTokens(WEDDING_VENUE_AGREEMENT_CONTENT);
    const approved = new Set(APPROVED_CONTRACT_KEYS);
    for (const token of tokens) {
      assert.ok(approved.has(token as (typeof APPROVED_CONTRACT_KEYS)[number]), token);
    }
  });

  it("message starters do not contain removed tokens", () => {
    for (const master of STARTER_MESSAGE_MASTERS) {
      const blob = `${master.emailSubject}\n${master.emailBody}\n${master.smsBody}`;
      for (const key of REMOVED) {
        assert.doesNotMatch(blob, new RegExp(`\\{\\{${key}\\}\\}`), `${master.key} ${key}`);
      }
    }
  });

  it("CTR-01 migration SQL matches approved starter and strips removed fields", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261407800000_contract_starter_ctr01_approved_smart_fields.sql"),
      "utf8",
    );
    assert.match(sql, /source_master_key = 'CTR-01'/);
    assert.match(sql, /Wedding Venue Agreement/);
    assert.match(sql, /\{\{client_name\}\}/);
    for (const key of REMOVED_MERGE_FIELD_KEYS) {
      assert.doesNotMatch(sql, new RegExp(`\\{\\{${key}\\}\\}`), key);
    }
  });
});

describe("pickers bind to the supported registries", () => {
  it("Contract Builder picker maps MERGE_FIELDS", () => {
    const builder = readFileSync(resolve("components/contracts/contract-builder.tsx"), "utf8");
    assert.match(builder, /MERGE_FIELDS\.map/);
    assert.doesNotMatch(builder, /couple_name/);
    assert.doesNotMatch(builder, /partner_name/);
    assert.doesNotMatch(builder, /primary_contact_name/);
  });

  it("message template picker maps MESSAGE_MERGE_FIELDS", () => {
    const form = readFileSync(resolve("components/communication/template-form.tsx"), "utf8");
    assert.match(form, /MESSAGE_MERGE_FIELDS\.map/);
    assert.doesNotMatch(form, /couple_name/);
    assert.doesNotMatch(form, /partner_name/);
  });
});

describe("canonical customer-name resolution", () => {
  it("client_name is the primary contact and does not concatenate a second person", () => {
    const data = buildContractMergeData({
      venueName: "Garden Hall",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      eventDate: "2027-06-12",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
    });
    assert.equal(data.client_name, "Ada Lovelace");
    assert.equal(data.couple_name, undefined);
    assert.equal(data.full_name, undefined);
    assert.equal(data.primary_contact_name, undefined);
    assert.equal(data.partner_name, undefined);
  });

  it("message merge does not invent a partner Smart Field when a second person is on the record", () => {
    const data = buildMessageMergeData({
      venueName: "Garden Hall",
      clientName: "Ada Lovelace",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      partnerFirstName: "Charles",
      partnerLastName: "Babbage",
      coordinatorName: "Jordan",
      eventDate: "2027-06-12",
    });
    assert.equal(data.client_name, "Ada Lovelace");
    assert.equal(data.first_name, "Ada");
    assert.equal(data.partner_name, undefined);
    assert.equal(data.partner_first_name, undefined);
    assert.equal(data.couple_name, undefined);
    assert.equal(data.full_name, undefined);
  });

  it("contract preview samples name both sample signers as the client party", () => {
    const sample = contractTemplatePreviewMergeData();
    assert.equal(sample.client_name, "Buppy Robicheaux & Joy Robicheaux");
    assert.equal(sample.couple_name, undefined);
    assert.equal(sample.full_name, undefined);
    assert.equal(sample.primary_contact_name, undefined);
    assert.equal(SAMPLE_MERGE_VALUES.client_name, "Sally Sunshine");
  });
});

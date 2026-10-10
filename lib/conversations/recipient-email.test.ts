/**
 * Saved lead email must be the recipient of a newly composed message.
 * No mail is sent — this asserts the address at the pre-send decision.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { chooseCurrentRecipientEmail } from "@/lib/conversations/recipient-email";
import { uniqueEmailDestinations } from "@/lib/scheduled-messages/email-destinations";
import { validateLeadInput } from "@/lib/leads/validation";

const OLD = "old.lead@example.test";
const NEXT = "new.lead@example.test";
const PARTNER = "partner.lead@example.test";

describe("newly composed message recipient after a lead email save", () => {
  it("uses the address saved on the lead when an older client snapshot is stale", () => {
    const beforeSave = chooseCurrentRecipientEmail({
      client: { email: OLD, updatedAt: "2026-10-01T12:00:00.000Z" },
      lead: { email: OLD, updatedAt: "2026-10-01T12:00:00.000Z" },
      relationship: { email: OLD, updatedAt: "2026-10-01T12:00:00.000Z" },
    });
    assert.equal(beforeSave, OLD);

    // Save persists the new lead email and bumps its updated_at. The client
    // row linked by a different lead_id is not rewritten and must not win.
    const afterSave = chooseCurrentRecipientEmail({
      client: { email: OLD, updatedAt: "2026-10-01T12:00:00.000Z" },
      lead: { email: NEXT, updatedAt: "2026-10-09T18:00:00.000Z" },
      relationship: { email: NEXT, updatedAt: "2026-10-09T18:00:01.000Z" },
    });
    assert.equal(afterSave, NEXT);
    assert.notEqual(afterSave, OLD);

    // Navigate away and back, and reload, call the same resolver again.
    const reopened = chooseCurrentRecipientEmail({
      client: { email: OLD, updatedAt: "2026-10-01T12:00:00.000Z" },
      lead: { email: NEXT, updatedAt: "2026-10-09T18:00:00.000Z" },
      relationship: { email: NEXT, updatedAt: "2026-10-09T18:00:01.000Z" },
    });
    assert.equal(reopened, NEXT);
  });

  it("keeps a newer client edit ahead of an older lead, and does not use the partner address", () => {
    const resolved = chooseCurrentRecipientEmail({
      client: { email: NEXT, updatedAt: "2026-10-09T19:00:00.000Z" },
      lead: { email: OLD, updatedAt: "2026-10-09T18:00:00.000Z" },
      relationship: { email: OLD, updatedAt: "2026-10-01T12:00:00.000Z" },
    });
    assert.equal(resolved, NEXT);

    const destinations = uniqueEmailDestinations({
      primaryEmail: resolved,
      partnerEmail: PARTNER,
    });
    assert.deepEqual(destinations, [
      { email: NEXT, role: "primary" },
      { email: PARTNER, role: "partner" },
    ]);
    assert.equal(destinations.some((d) => d.email === OLD), false);
    assert.equal(destinations.filter((d) => d.email === NEXT).length, 1);
  });

  it("dedupes primary and partner when they are the same address", () => {
    const destinations = uniqueEmailDestinations({
      primaryEmail: NEXT,
      partnerEmail: NEXT.toUpperCase(),
    });
    assert.deepEqual(destinations, [{ email: NEXT, role: "primary" }]);
  });

  it("ignores a blank client email and falls through to the saved lead", () => {
    assert.equal(
      chooseCurrentRecipientEmail({
        client: { email: "  ", updatedAt: "2026-10-09T20:00:00.000Z" },
        lead: { email: NEXT, updatedAt: "2026-10-09T18:00:00.000Z" },
        relationship: { email: null, updatedAt: null },
      }),
      NEXT,
    );
  });

  it("rejects an invalid lead email before any write", () => {
    const errors = validateLeadInput({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "not-an-email",
      phone: "",
      partnerFirstName: "",
      partnerLastName: "",
      partnerEmail: "",
      eventType: "",
      eventDate: "",
      endDate: "",
      guestCount: "",
      estimatedBudget: "",
      source: "",
      inquiryMessage: "",
      inquiryDate: "",
    });
    assert.equal(errors.email, "Enter a valid email address.");
    assert.equal(
      chooseCurrentRecipientEmail({
        client: null,
        lead: { email: OLD, updatedAt: "2026-10-01T12:00:00.000Z" },
        relationship: { email: OLD, updatedAt: "2026-10-01T12:00:00.000Z" },
      }),
      OLD,
    );
  });
});

describe("send boundary uses the canonical resolver", () => {
  const service = readFileSync(resolve("lib/conversations/service.ts"), "utf8");
  const repo = readFileSync(resolve("lib/conversations/repository.ts"), "utf8");
  const leads = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
  const leadService = readFileSync(resolve("lib/leads/service.ts"), "utf8");
  const processor = readFileSync(resolve("lib/scheduled-messages/processor.ts"), "utf8");
  const editForm = readFileSync(resolve("components/leads/lead-edit-form.tsx"), "utf8");

  it("email send reads getConversationRecipientEmail at send time and does not take a client-supplied address", () => {
    const send = service.slice(
      service.indexOf("export async function sendConversationMessage"),
      service.indexOf("export async function sendPortalConversationMessage"),
    );
    const emailBranch = send.slice(send.indexOf('channel === "email"'), send.indexOf("const result = await repo.sendConversationMessage"));
    assert.match(emailBranch, /getConversationRecipientEmail/);
    assert.match(emailBranch, /sendEmail\(\{[\s\S]*to: email/);
    assert.match(emailBranch, /assertChannelAllowed/);
    assert.doesNotMatch(emailBranch, /context\.recipientEmail/);
    const portal = send.slice(0, send.indexOf('channel === "email"'));
    assert.doesNotMatch(portal, /getConversationRecipientEmail/);
  });

  it("the resolver compares updated_at and does not return the first client email it sees", () => {
    const fn = repo.slice(
      repo.indexOf("export async function getConversationRecipientEmail"),
      repo.indexOf("function coupleDisplayName"),
    );
    const clientsAt = fn.indexOf('.from("clients")');
    const leadsAt = fn.indexOf('.from("leads")');
    const relAt = fn.indexOf("venue_customer_relationships");
    assert.ok(clientsAt >= 0 && leadsAt > clientsAt && relAt > leadsAt);
    assert.match(fn, /chooseCurrentRecipientEmail/);
    assert.match(fn, /updated_at/);
    assert.doesNotMatch(fn, /if \(bookedEmail\) return bookedEmail/);
  });

  it("a lead email save updates the relationship, linked client, stale same-email clients, and tour contact email", () => {
    const fn = leads.slice(
      leads.indexOf("export async function updateLeadInfo"),
      leads.indexOf("export async function setPlannedEventSpace"),
    );
    assert.match(fn, /relationshipContactPatch/);
    assert.match(fn, /linkedClientIdentityPatch/);
    assert.match(fn, /contact_email/);
    assert.match(fn, /previousEmail/);
    assert.doesNotMatch(fn, /insertClient/);
  });

  it("a lead in another venue is not updated", () => {
    const fn = leadService.slice(
      leadService.indexOf("export async function updateLeadInfo"),
      leadService.indexOf("export async function updateRelationshipFields"),
    );
    assert.match(fn, /eq\("venue_id", venueId\)/);
    assert.match(fn, /Lead not found/);
  });

  it("scheduled sends re-resolve the relationship at delivery and do not store a recipient snapshot", () => {
    assert.match(processor, /getRecipientContactForRelationship/);
    assert.match(processor, /uniqueEmailDestinations/);
    assert.doesNotMatch(processor, /to_email/);
    const insert = readFileSync(resolve("lib/scheduled-messages/repository.ts"), "utf8");
    const insertStart = insert.indexOf("export async function insertScheduledMessage");
    const insertFn = insert.slice(insertStart, insert.indexOf("export async function getScheduledForRelationship"));
    assert.doesNotMatch(insertFn, /recipient/);
  });

  it("a failed lead save does not navigate to the updated lead card", () => {
    const submitStart = editForm.indexOf("function handleSubmit");
    const submit = editForm.slice(submitStart, editForm.indexOf("return (", submitStart));
    const okBranch = submit.slice(submit.indexOf("if (result.ok)"), submit.indexOf("if (result.errors)"));
    assert.match(okBranch, /router\.replace/);
    assert.doesNotMatch(submit.slice(submit.indexOf("if (result.errors)")), /router\.replace/);
    assert.match(submit, /const current = inputRef\.current/);
    assert.match(submit, /updateLeadInfoAction\(lead\.id, current\)/);
    assert.doesNotMatch(submit, /updateLeadInfoAction\(lead\.id, input\)/);
  });
});

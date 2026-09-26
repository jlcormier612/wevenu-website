import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { linkedClientIdentityPatch, relationshipContactPatch } from "@/lib/clients/contact-edit";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function functionBody(src: string, name: string, nextName: string) {
  const start = src.indexOf(`export async function ${name}`);
  const end = src.indexOf(`export async function ${nextName}`, start + 1);
  assert.ok(start >= 0 && end > start, `${name} slice`);
  return src.slice(start, end);
}

describe("client contact workspace", () => {
  it("updates the existing relationship name and email without inquiry or source", () => {
    const patch = relationshipContactPatch({
      firstName: "  Alison ",
      lastName: " Morrill ",
      email: " alison@hellotocheers.test ",
    });
    assert.deepEqual(patch, {
      first_name: "Alison",
      last_name: "Morrill",
      email: "alison@hellotocheers.test",
    });
    assert.equal("inquiry_message" in patch, false);
    assert.equal("source" in patch, false);
    assert.equal("event_date" in patch, false);
    assert.equal(relationshipContactPatch({ firstName: "A", lastName: "B", email: "  " }).email, null);
  });

  it("lead-linked client identity patch updates the same customer fields without event data", () => {
    const patch = linkedClientIdentityPatch({
      firstName: " Popeye ",
      lastName: " Spinach ",
      email: " jlcormier612@gmail.com ",
      phone: " 5089896064 ",
      partnerFirstName: " Olive ",
      partnerLastName: " Oil ",
      partnerEmail: " jyagnesak@yahoo.com ",
    });
    assert.deepEqual(patch, {
      first_name: "Popeye",
      last_name: "Spinach",
      email: "jlcormier612@gmail.com",
      phone: "5089896064",
      partner_first_name: "Olive",
      partner_last_name: "Oil",
      partner_email: "jyagnesak@yahoo.com",
    });
    assert.equal("event_date" in patch, false);
    assert.equal("lead_id" in patch, false);
    assert.equal("id" in patch, false);
  });

  it("writes contact onto the existing client and relationship, not a new record or the lead", () => {
    const repo = source("lib/clients/repository.ts");
    const fn = functionBody(repo, "updateClientInfo", "updateClientStatus");
    assert.match(fn, /venue_customer_relationships/);
    assert.match(fn, /relationshipContactPatch/);
    assert.match(fn, /\.update\(relationshipContactPatch/);
    assert.match(fn, /\.from\("clients"\)/);
    assert.doesNotMatch(fn, /\.from\("leads"\)/);
    assert.doesNotMatch(fn, /inquiry_message/);
    assert.doesNotMatch(fn, /\.insert\(/);
    assert.match(fn, /delete row\.event_type/);
    assert.match(fn, /delete row\.event_date/);
    assert.match(fn, /delete row\.guest_count/);
  });

  it("keeps booking conversion separate from contact edits", () => {
    const service = source("lib/clients/service.ts");
    const convert = functionBody(service, "convertLeadToClient", "updateClientInfo");
    assert.doesNotMatch(convert, /relationshipContactPatch/);
    const edit = functionBody(service, "updateClientInfo", "updateClientStatus_");
    assert.doesNotMatch(edit, /bookClient\(/);
    assert.doesNotMatch(edit, /insertClient\(/);
    assert.doesNotMatch(edit, /convertLeadToClient\(/);
    const book = source("lib/booking-journey/book-client.ts");
    assert.doesNotMatch(book, /contact-edit/);
    assert.doesNotMatch(book, /updateClientInfo/);
  });

  it("shows Contact Information edit on the client workspace, separate from event edit", () => {
    const overview = source("components/events/booking-overview-summary.tsx");
    assert.match(overview, /Contact Information/);
    assert.match(overview, /Original inquiry/);
    assert.match(overview, /href=\{`\/clients\/\$\{contact\.clientId\}\/edit`\}/);
    assert.match(overview, /aria-label="Edit contact information"/);

    const detail = source("components/events/event-detail.tsx");
    assert.match(detail, /Edit event/);
    assert.match(detail, /Event information/);
    assert.match(detail, /href=\{`\/events\/\$\{event\.id\}\/edit`\}/);

    const form = source("components/clients/client-form.tsx");
    assert.match(form, /contactOnly/);
    assert.match(form, /\{!contactOnly && \(/);
    const edit = source("components/clients/client-edit-form.tsx");
    assert.match(edit, /contactOnly=\{Boolean\(client\.linkedEventId\)\}/);
    const page = source("app/(app)/clients/[id]/edit/page.tsx");
    assert.match(page, /Contact information/);
    assert.match(page, /Event details are edited on the event/);
  });

  it("loads current contact from the client and historical inquiry from the lead", () => {
    const page = source("app/(app)/clients/[id]/page.tsx");
    assert.match(page, /firstName: client\.firstName/);
    assert.match(page, /email: cl\?\.email \|\| client\.email/);
    assert.match(page, /inquiryMessage: leadRow\?\.inquiry_message/);
    assert.match(page, /\.select\("source, inquiry_message"\)/);
    assert.doesNotMatch(page, /leadRow\?\.phone/);
    assert.doesNotMatch(page, /leadRow\?\.email/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeEmailForCompare,
  uniqueEmailDestinations,
} from "@/lib/scheduled-messages/email-destinations";
import { mergeContextForEmailDestination } from "@/lib/scheduled-messages/recipient-merge";
import {
  buildMergeData,
  resolveForCustomerSend,
  type MergeContext,
} from "@/lib/message-templates/merge";
import { MESSAGE_MERGE_FIELDS } from "@/lib/message-templates/constants";
import { STARTER_MESSAGE_MASTERS } from "@/lib/message-templates/starters";
import { SAMPLE_MERGE_VALUES } from "@/lib/message-templates/preview";

const baseCouple: MergeContext = {
  venueName: "Willow Creek Estate",
  clientName: "Grace Van Pelt",
  clientFirstName: "Grace",
  clientLastName: "Van Pelt",
  partnerFirstName: "Wayne",
  partnerLastName: "Rigsby",
  coordinatorName: "Jordan",
  eventDate: "2027-06-12",
};

describe("uniqueEmailDestinations", () => {
  it("primary only → one destination", () => {
    const d = uniqueEmailDestinations({
      primaryEmail: "grace@example.com",
      partnerEmail: null,
    });
    assert.deepEqual(d, [{ email: "grace@example.com", role: "primary" }]);
  });

  it("primary + partner → two destinations", () => {
    const d = uniqueEmailDestinations({
      primaryEmail: "grace@example.com",
      partnerEmail: "wayne@example.com",
    });
    assert.equal(d.length, 2);
    assert.equal(d[0]!.role, "primary");
    assert.equal(d[1]!.role, "partner");
  });

  it("identical addresses → one destination", () => {
    const d = uniqueEmailDestinations({
      primaryEmail: "same@example.com",
      partnerEmail: "same@example.com",
    });
    assert.equal(d.length, 1);
    assert.equal(d[0]!.role, "primary");
  });

  it("same address different casing → one destination", () => {
    const d = uniqueEmailDestinations({
      primaryEmail: "Grace@example.com",
      partnerEmail: "grace@example.com",
    });
    assert.equal(d.length, 1);
    assert.equal(normalizeEmailForCompare(d[0]!.email), "grace@example.com");
  });

  it("missing/invalid partner email does not create a destination", () => {
    assert.equal(
      uniqueEmailDestinations({
        primaryEmail: "grace@example.com",
        partnerEmail: "not-an-email",
      }).length,
      1,
    );
    assert.equal(
      uniqueEmailDestinations({
        primaryEmail: "grace@example.com",
        partnerEmail: "   ",
      }).length,
      1,
    );
  });
});

describe("recipient-specific merge", () => {
  it("primary receives own first name; client_name stays the primary contact", () => {
    const ctx = mergeContextForEmailDestination(baseCouple, "primary");
    const data = buildMergeData(ctx);
    assert.equal(data.first_name, "Grace");
    assert.equal(data.last_name, "Van Pelt");
    assert.equal(data.client_name, "Grace Van Pelt");
    assert.equal(data.partner_first_name, undefined);
    assert.equal(data.partner_name, undefined);
  });

  it("second destination is addressed by their own first name without a partner Smart Field", () => {
    const ctx = mergeContextForEmailDestination(baseCouple, "partner");
    const data = buildMergeData(ctx);
    assert.equal(data.first_name, "Wayne");
    assert.equal(data.last_name, "Rigsby");
    assert.equal(data.client_name, "Grace Van Pelt");
    assert.equal(data.full_name, undefined);
    assert.equal(data.partner_first_name, undefined);
    assert.equal(data.partner_full_name, undefined);
    assert.equal(data.partner_name, undefined);
  });

  it("missing second person does not fabricate partner fields", () => {
    const data = buildMergeData({
      venueName: "Venue",
      clientName: "Grace Van Pelt",
      clientFirstName: "Grace",
      clientLastName: "Van Pelt",
      coordinatorName: "Jordan",
      eventDate: null,
    });
    assert.equal(data.first_name, "Grace");
    assert.equal(data.partner_first_name, undefined);
    assert.equal(data.partner_full_name, undefined);
    assert.equal(data.partner_name, undefined);
  });

  it("obsolete partner_first_name token is not resolved and refuses send", () => {
    const result = resolveForCustomerSend(
      "Hi {{first_name}} and {{partner_first_name}},",
      "Hello",
      {
        venueName: "Venue",
        clientName: "Grace",
        clientFirstName: "Grace",
        partnerFirstName: "Wayne",
        coordinatorName: "Jordan",
        eventDate: null,
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.tokens.includes("partner_first_name"));
    }
  });

  it("primary-only Hi {{first_name}} still sends", () => {
    const result = resolveForCustomerSend("Hi {{first_name}},", "Hello", {
      venueName: "Venue",
      clientName: "Grace",
      clientFirstName: "Grace",
      coordinatorName: "Jordan",
      eventDate: null,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.body, "Hi Grace,");
  });
});

describe("partner merge catalog + starters", () => {
  it("MESSAGE_MERGE_FIELDS does not include partner or couple tokens", () => {
    const keys = MESSAGE_MERGE_FIELDS.map((f) => f.key);
    assert.ok(!keys.includes("partner_name"));
    assert.ok(!keys.includes("partner_first_name"));
    assert.ok(!keys.includes("partner_last_name"));
    assert.ok(!keys.includes("partner_full_name"));
    assert.ok(!keys.includes("couple_name"));
    assert.ok(!keys.includes("full_name"));
    assert.ok(keys.includes("client_name"));
  });

  it("SAMPLE_MERGE_VALUES does not cover removed partner/couple fields", () => {
    assert.equal(SAMPLE_MERGE_VALUES.partner_first_name, undefined);
    assert.equal(SAMPLE_MERGE_VALUES.partner_full_name, undefined);
    assert.equal(SAMPLE_MERGE_VALUES.couple_name, undefined);
    assert.ok(SAMPLE_MERGE_VALUES.client_name);
  });

  it("MSG-01 through MSG-11 open with Hi {{first_name}},", () => {
    for (const master of STARTER_MESSAGE_MASTERS) {
      assert.match(master.emailBody, /^Hi \{\{first_name\}\},/);
      assert.doesNotMatch(master.emailBody, /^Hi \{\{client_name\}\},/);
    }
  });
});

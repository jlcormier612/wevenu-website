import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderEmailTemplate } from "./registry";
import {
  greetingSalutation,
  personGreetingName,
  venueName,
} from "./helpers";

describe("personGreetingName / greetingSalutation hierarchy", () => {
  it("prefers billing contact first name over owner and venue", () => {
    const vars = {
      billingFirstName: "Jordan",
      firstName: "Alex",
      venueName: "Rosewood Barn",
    };
    assert.equal(personGreetingName(vars), "Jordan");
    assert.equal(greetingSalutation(vars), "Hi Jordan,");
  });

  it("falls back to account owner when billing name is missing", () => {
    const vars = {
      ownerFirstName: "Alex",
      venueName: "Rosewood Barn",
    };
    assert.equal(personGreetingName(vars), "Alex");
    assert.equal(greetingSalutation(vars), "Hi Alex,");
  });

  it("uses neutral Hello when no valid person name exists", () => {
    const vars = { venueName: "Rosewood Barn", venue_name: "Rosewood Barn" };
    assert.equal(personGreetingName(vars), null);
    assert.equal(greetingSalutation(vars), "Hello,");
    assert.equal(venueName(vars), "Rosewood Barn");
  });

  it("never treats venue placeholder as a person name", () => {
    assert.equal(greetingSalutation({}), "Hello,");
    assert.doesNotMatch(greetingSalutation({ venueName: "your venue" }), /your venue/i);
  });

  it("accepts snake_case billing fields from notice drafts", () => {
    assert.equal(
      greetingSalutation({
        billing_full_name: "Sam Rivera",
        venue_name: "Willow Grove",
      }),
      "Hi Sam,",
    );
  });
});

describe("SaaS lifecycle emails — rendered greetings", () => {
  const cases = [
    "payment_reminder",
    "account_suspended",
    "account_reactivated",
    "renewal_reminder",
  ] as const;

  for (const id of cases) {
    it(`${id}: billing name wins; never greets the venue`, () => {
      const withBilling = renderEmailTemplate(id, {
        billingFirstName: "Morgan",
        firstName: "Casey",
        venueName: "Cedar Hall",
        venue_name: "Cedar Hall",
        current_plan_name: "Gather",
        new_plan_name: "Celebrate",
        peak_count: "30",
        peak_year: "2026",
        dunningDay: 3,
      });
      assert.match(withBilling.text, /^Hi Morgan,/);
      assert.doesNotMatch(withBilling.text, /^Hi Cedar Hall,/);
      assert.doesNotMatch(withBilling.text, /^Hi your venue,/);
      assert.match(withBilling.html, /Hi Morgan,/);

      const missing = renderEmailTemplate(id, {
        venueName: "Cedar Hall",
        venue_name: "Cedar Hall",
        current_plan_name: "Gather",
        new_plan_name: "Celebrate",
        peak_count: "30",
        peak_year: "2026",
        dunningDay: 7,
      });
      assert.match(missing.text, /^Hello,/);
      assert.doesNotMatch(missing.text, /^Hi Cedar Hall,/);
      assert.doesNotMatch(missing.text, /^Hi your venue,/);
      assert.match(missing.html, />Hello,</);
    });
  }

});

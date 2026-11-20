import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bookingClientHeadingName,
  bookingContactPeople,
} from "@/lib/clients/booking-identity";

describe("bookingClientHeadingName", () => {
  it("uses clientDisplayName from the client record, not the event title", () => {
    assert.equal(
      bookingClientHeadingName({
        contact: {
          firstName: "Amelia",
          lastName: "Foster",
          partnerFirstName: "Ben",
          partnerLastName: "Foster",
        },
        clientName: "Amelia Foster & Ben Foster",
        eventName: "Autumn Grove Dinner",
      }),
      "Amelia Foster & Ben Foster",
    );
  });

  it("formats Olivia & James from person fields", () => {
    assert.equal(
      bookingClientHeadingName({
        contact: {
          firstName: "Olivia",
          lastName: "Hayes",
          partnerFirstName: "James",
          partnerLastName: "Hayes",
        },
        eventName: "Olivia & James Hayes Wedding",
      }),
      "Olivia Hayes & James Hayes",
    );
  });

  it("shows a single person without inventing a partner", () => {
    assert.equal(
      bookingClientHeadingName({
        contact: {
          firstName: "Jordan",
          lastName: "Lee",
          partnerFirstName: null,
          partnerLastName: null,
        },
        eventName: "Jordan Lee Birthday",
      }),
      "Jordan Lee",
    );
  });
});

describe("bookingContactPeople", () => {
  it("returns two people with emails for a couple; no Primary/Partner labels", () => {
    assert.deepEqual(
      bookingContactPeople({
        firstName: "Amelia",
        lastName: "Foster",
        partnerFirstName: "Ben",
        partnerLastName: "Foster",
        email: "amelia.foster@thewillowgrove.com",
        phone: null,
        partnerEmail: "ben.foster@thewillowgrove.com",
      }),
      [
        { name: "Amelia Foster", email: "amelia.foster@thewillowgrove.com", phone: undefined },
        { name: "Ben Foster", email: "ben.foster@thewillowgrove.com", phone: undefined },
      ],
    );
  });

  it("omits empty second person for single-person records", () => {
    assert.deepEqual(
      bookingContactPeople({
        firstName: "Ivy",
        lastName: "Quinn",
        partnerFirstName: null,
        partnerLastName: null,
        email: "ivy@example.com",
        phone: null,
        partnerEmail: null,
      }),
      [{ name: "Ivy Quinn", email: "ivy@example.com", phone: undefined }],
    );
  });

  it("includes phone when present", () => {
    const people = bookingContactPeople({
      firstName: "Olivia",
      lastName: "Hayes",
      partnerFirstName: "James",
      partnerLastName: "Hayes",
      email: "olivia@example.com",
      phone: "(802) 555-0199",
      partnerEmail: "james@example.com",
    });
    assert.equal(people[0]?.phone, "(802) 555-0199");
    assert.equal(people.length, 2);
  });
});

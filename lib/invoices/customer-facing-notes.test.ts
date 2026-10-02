import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  customerFacingPaymentInstructions,
  customerFacingVenueDisplayName,
  customerFacingVenueNote,
  isSystemBookingCommitmentNote,
} from "@/lib/invoices/customer-facing-notes";

describe("payment document note provenance", () => {
  const SYSTEM = "Essential Wedding — booking commitment";

  it("classifies guided-setup commitment text as system metadata", () => {
    assert.equal(isSystemBookingCommitmentNote(SYSTEM), true);
    assert.equal(isSystemBookingCommitmentNote("Signature Wedding — booking commitment"), true);
    assert.equal(isSystemBookingCommitmentNote("Please wire to account 123"), false);
    assert.equal(isSystemBookingCommitmentNote(""), false);
    assert.equal(isSystemBookingCommitmentNote(null), false);
  });

  it("1. payment instructions only — no duplicate Notes", () => {
    const instructions = customerFacingPaymentInstructions({
      scheduleNotes: "Wire to ABC Bank",
      invoiceNotes: null,
    });
    const note = customerFacingVenueNote({
      invoiceNotes: null,
      paymentInstructions: instructions,
    });
    assert.equal(instructions, "Wire to ABC Bank");
    assert.equal(note, null);
  });

  it("2. genuine venue-authored note — shown once with customer-facing venue name", () => {
    const note = customerFacingVenueNote({
      invoiceNotes: "Congrats — looking forward to your day!",
      paymentInstructions: null,
    });
    assert.equal(note, "Congrats — looking forward to your day!");
    assert.equal(
      customerFacingVenueDisplayName({ name: "Jen's Fancy Venue", businessName: "Fancy Venue LLC" }),
      "Jen's Fancy Venue",
    );
  });

  it("3. payment instructions + genuine venue note — both, neither duplicated", () => {
    const instructions = customerFacingPaymentInstructions({
      scheduleNotes: "Pay via portal",
      invoiceNotes: "Venue handwritten note",
    });
    const note = customerFacingVenueNote({
      invoiceNotes: "Venue handwritten note",
      paymentInstructions: instructions,
    });
    assert.equal(instructions, "Pay via portal");
    assert.equal(note, "Venue handwritten note");
  });

  it("4. system booking-commitment metadata does not masquerade as venue notes or instructions", () => {
    assert.equal(
      customerFacingPaymentInstructions({ scheduleNotes: null, invoiceNotes: SYSTEM }),
      null,
    );
    assert.equal(
      customerFacingVenueNote({ invoiceNotes: SYSTEM, paymentInstructions: null }),
      null,
    );
    // Same value in both fields — still suppressed
    assert.equal(
      customerFacingVenueNote({
        invoiceNotes: SYSTEM,
        paymentInstructions: SYSTEM,
      }),
      null,
    );
  });

  it("5. legal entity differs from customer-facing name — notes use display name", () => {
    assert.equal(
      customerFacingVenueDisplayName({
        name: "Jen's Fancy Venue",
        businessName: "Fancy Venue LLC",
      }),
      "Jen's Fancy Venue",
    );
    // Fallback only when display name missing
    assert.equal(
      customerFacingVenueDisplayName({ name: "", businessName: "Fancy Venue LLC" }),
      "Fancy Venue LLC",
    );
  });

  it("identical instructions + notes collapse Notes section", () => {
    assert.equal(
      customerFacingVenueNote({
        invoiceNotes: "Same text",
        paymentInstructions: "Same text",
      }),
      null,
    );
  });
});

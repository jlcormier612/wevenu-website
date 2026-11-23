import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAcceptedSnapshot,
  canAcceptOffer,
  checkoutIdempotencyKey,
  createMemorySalesOfferStore,
  normalizeOfferEmail,
  salesOfferCouponSpec,
  salesOfferOnboardingType,
  salesOfferWhiteGloveChargeCents,
} from "./index";

describe("Stage 2 sales offer lifecycle helpers", () => {
  it("normalizes and validates recipient email", () => {
    assert.equal(normalizeOfferEmail("  Jen@HelloToCheers.com "), "jen@hellotocheers.com");
    assert.equal(normalizeOfferEmail("not-an-email"), null);
    assert.equal(normalizeOfferEmail(""), null);
  });

  it("blocks accept on expired / revoked / superseded", async () => {
    const store = createMemorySalesOfferStore();
    const draft = await store.createDraft({
      relationshipId: "rel_1",
      internalName: "Test",
      terms: {
        planKey: "starter",
        pricingKind: "fixed_rate",
        fixedRateCents: 14900,
        durationMode: "ongoing",
        afterIntroPricing: "standard_list",
        whiteGloveMode: "none",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      createdByEmail: "founder@test.com",
    });
    const sent = await store.markSent({
      offerId: draft.id,
      relationshipId: "rel_1",
      expectedRevision: draft.revision,
      recipientName: "Jen",
      recipientEmail: "jen@example.com",
    });
    const gate = canAcceptOffer(sent);
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "offer_expired");
  });

  it("send → accept snapshot is immutable source for checkout coupon", async () => {
    const store = createMemorySalesOfferStore();
    const draft = await store.createDraft({
      relationshipId: "rel_a",
      internalName: "A",
      terms: {
        planKey: "growing",
        pricingKind: "fixed_rate",
        fixedRateCents: 19900,
        durationMode: "billing_cycles",
        durationBillingCycles: 6,
        afterIntroPricing: "standard_list",
        whiteGloveMode: "none",
      },
      createdByEmail: "founder@test.com",
    });
    const sent = await store.markSent({
      offerId: draft.id,
      relationshipId: "rel_a",
      expectedRevision: draft.revision,
      recipientName: "Alex Owner",
      recipientEmail: "alex@venue.test",
      customerMessage: "Excited to partner",
    });
    assert.equal(sent.status, "sent");
    assert.ok(sent.publicToken.length >= 32);
    assert.equal(sent.checkoutSessionId, null);

    const snap = buildAcceptedSnapshot({
      offer: sent,
      venueName: "Test Venue",
      recipientName: "Alex Owner",
      recipientEmail: "alex@venue.test",
      acceptedAt: new Date().toISOString(),
    });
    assert.ok(!("error" in snap));
    if ("error" in snap) return;

    assert.equal(snap.monthlyRecurringCents, 19900);
    assert.equal(snap.listAmountCents, 24900);
    assert.equal(salesOfferOnboardingType(snap), "self_guided");
    assert.equal(salesOfferWhiteGloveChargeCents(snap), 0);

    const coupon = salesOfferCouponSpec(snap);
    assert.ok(coupon);
    assert.equal(coupon!.kind, "amount_off");
    if (coupon!.kind === "amount_off") {
      assert.equal(coupon!.amountOffCents, 5000);
      assert.equal(coupon!.duration, "repeating");
      assert.equal(coupon!.durationInMonths, 6);
    }

    const accepted = await store.markAccepted({
      offerId: sent.id,
      acceptedSnapshot: snap as unknown as Record<string, unknown>,
      acceptedRevision: sent.revision,
    });
    assert.equal(accepted.status, "accepted");

    // Mutating draft fields after accept must not change the snapshot coupon.
    const key1 = checkoutIdempotencyKey(snap);
    const key2 = checkoutIdempotencyKey(snap);
    assert.equal(key1, key2);

    const dup = await store.markAccepted({
      offerId: sent.id,
      acceptedSnapshot: { ...snap, monthlyRecurringCents: 1 } as unknown as Record<
        string,
        unknown
      >,
      acceptedRevision: sent.revision,
    });
    assert.equal(
      (dup.acceptedSnapshot as { monthlyRecurringCents?: number })
        ?.monthlyRecurringCents,
      19900,
    );
  });

  it("white glove custom fee is included in charge cents", async () => {
    const store = createMemorySalesOfferStore();
    const draft = await store.createDraft({
      relationshipId: "rel_wg",
      internalName: "WG",
      terms: {
        planKey: "starter",
        pricingKind: "percent_off",
        percentOff: 10,
        durationMode: "ongoing",
        afterIntroPricing: "eligible_discount",
        whiteGloveMode: "custom",
        whiteGloveAmountCents: 29900,
        standardDiscountEligibility: "former_weven",
        standardDiscountEvidence: "founder_recorded",
      },
      createdByEmail: "founder@test.com",
    });
    const sent = await store.markSent({
      offerId: draft.id,
      relationshipId: "rel_wg",
      expectedRevision: draft.revision,
      recipientName: "Sam",
      recipientEmail: "sam@venue.test",
    });
    const snap = buildAcceptedSnapshot({
      offer: sent,
      venueName: "WG Venue",
      recipientName: "Sam",
      recipientEmail: "sam@venue.test",
      acceptedAt: new Date().toISOString(),
    });
    assert.ok(!("error" in snap));
    if ("error" in snap) return;
    assert.equal(salesOfferOnboardingType(snap), "white_glove");
    assert.equal(salesOfferWhiteGloveChargeCents(snap), 29900);
    const coupon = salesOfferCouponSpec(snap);
    assert.ok(coupon);
    assert.equal(coupon!.kind, "percent_off");
  });

  it("supersede blocks old offer and creates new draft", async () => {
    const store = createMemorySalesOfferStore();
    const draft = await store.createDraft({
      relationshipId: "rel_s",
      internalName: "S",
      terms: {
        planKey: "starter",
        pricingKind: "standard",
        durationMode: "ongoing",
        afterIntroPricing: "standard_list",
        whiteGloveMode: "none",
      },
      createdByEmail: "founder@test.com",
    });
    const sent = await store.markSent({
      offerId: draft.id,
      relationshipId: "rel_s",
      expectedRevision: draft.revision,
      recipientName: "Pat",
      recipientEmail: "pat@venue.test",
    });
    const { previous, draft: next } = await store.supersedeWithDraft({
      offerId: sent.id,
      relationshipId: "rel_s",
      expectedRevision: sent.revision,
      createdByEmail: "founder@test.com",
    });
    assert.equal(previous.status, "superseded");
    assert.equal(next.status, "draft");
    assert.equal(next.supersedesOfferId, previous.id);
    const gate = canAcceptOffer(previous);
    assert.equal(gate.ok, false);
  });

  it("markPaid is idempotent", async () => {
    const store = createMemorySalesOfferStore();
    const draft = await store.createDraft({
      relationshipId: "rel_p",
      internalName: "P",
      terms: {
        planKey: "starter",
        pricingKind: "standard",
        durationMode: "ongoing",
        afterIntroPricing: "standard_list",
        whiteGloveMode: "none",
      },
      createdByEmail: "founder@test.com",
    });
    const sent = await store.markSent({
      offerId: draft.id,
      relationshipId: "rel_p",
      expectedRevision: draft.revision,
      recipientName: "Pat",
      recipientEmail: "pat@venue.test",
    });
    const snap = buildAcceptedSnapshot({
      offer: sent,
      venueName: "P",
      recipientName: "Pat",
      recipientEmail: "pat@venue.test",
      acceptedAt: new Date().toISOString(),
    });
    assert.ok(!("error" in snap));
    if ("error" in snap) return;
    await store.markAccepted({
      offerId: sent.id,
      acceptedSnapshot: snap as unknown as Record<string, unknown>,
      acceptedRevision: sent.revision,
    });
    await store.markCheckoutPending({
      offerId: sent.id,
      checkoutSessionId: "cs_test_1",
    });
    const paid1 = await store.markPaid({
      offerId: sent.id,
      checkoutSessionId: "cs_test_1",
    });
    const paid2 = await store.markPaid({
      offerId: sent.id,
      checkoutSessionId: "cs_test_1",
    });
    assert.equal(paid1.status, "paid");
    assert.equal(paid2.status, "paid");
    assert.equal(paid1.paidAt, paid2.paidAt);
  });
});

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  decidePurchaseMatch,
  isEstablishedPurchaseRelationship,
  resolveSubscriptionLifecycleRelationship,
  type PurchaseIdentity,
} from "./service";

const A: PurchaseIdentity & {
  subscribedAt?: string;
  activationCompletedAt?: string;
  productSync?: { venueId?: string };
} = {
  id: "rel_a",
  owner: { email: "owner@example.com" },
  venue: { name: "Cedar Hall" },
  stripeCheckoutSessionId: "cs_a",
  stripeSubscriptionId: "sub_a",
  activationToken: "act_a",
  subscribedAt: "2026-10-05T07:49:02.357Z",
  activationCompletedAt: "2026-10-05T07:53:09.880Z",
};

describe("established purchase evidence", () => {
  it("treats subscription, subscribedAt, token, activation, venue, or child sub as established", () => {
    assert.equal(isEstablishedPurchaseRelationship({ stripeSubscriptionId: "sub_a" }), true);
    assert.equal(isEstablishedPurchaseRelationship({ subscribedAt: "2026-10-05T00:00:00Z" }), true);
    assert.equal(isEstablishedPurchaseRelationship({ activationToken: "act_a" }), true);
    assert.equal(
      isEstablishedPurchaseRelationship({ activationCompletedAt: "2026-10-05T00:00:00Z" }),
      true,
    );
    assert.equal(
      isEstablishedPurchaseRelationship({ productSync: { venueId: "venue_a" } }),
      true,
    );
    assert.equal(
      isEstablishedPurchaseRelationship({ id: "rel_a" }, [
        { relationshipId: "rel_a", stripeSubscriptionId: "sub_a" },
      ]),
      true,
    );
  });

  it("does not treat a bare checkout session as an established purchase", () => {
    assert.equal(
      isEstablishedPurchaseRelationship({
        id: "rel_draft",
        stripeCheckoutSessionId: "cs_draft",
      }),
      false,
    );
  });
});

describe("checkout.session.completed classification", () => {
  it("first purchase with no relationship creates", () => {
    const decision = decidePurchaseMatch([], [], {
      email: "new@example.com",
      venueName: "New Hall",
      stripeCheckoutSessionId: "cs_new",
      stripeSubscriptionId: "sub_new",
    });
    assert.equal(decision.action, "create");
  });

  it("same session replays the existing purchase", () => {
    const decision = decidePurchaseMatch([A], [], {
      email: "owner@example.com",
      venueName: "Cedar Hall",
      stripeCheckoutSessionId: "cs_a",
      stripeSubscriptionId: "sub_a",
    });
    assert.equal(decision.action, "reuse");
  });

  it("different venue creates and does not reuse A", () => {
    const decision = decidePurchaseMatch([A], [], {
      email: "owner@example.com",
      venueName: "Maple Barn",
      stripeCheckoutSessionId: "cs_b",
      stripeSubscriptionId: "sub_b",
    });
    assert.equal(decision.action, "create");
  });

  it("same email and same normalized venue holds without selecting A as the new purchase", () => {
    const decision = decidePurchaseMatch([A], [], {
      email: "owner@example.com",
      venueName: "cedar hall",
      stripeCheckoutSessionId: "cs_hold",
      stripeSubscriptionId: "sub_hold",
    });
    assert.equal(decision.action, "hold");
    if (decision.action === "hold") {
      assert.equal(decision.relationship.stripeCheckoutSessionId, "cs_a");
      assert.equal(decision.relationship.stripeSubscriptionId, "sub_a");
    }
  });
});

describe("subscription.created before checkout.completed", () => {
  it("does not attach a new subscription to an established purchase", () => {
    const target = resolveSubscriptionLifecycleRelationship(
      [A],
      [{ relationshipId: "rel_a", stripeSubscriptionId: "sub_a" }],
      { stripeSubscriptionId: "sub_b" },
    );
    assert.equal(target, null);
  });

  it("enriches the purchase that already owns the subscription", () => {
    const target = resolveSubscriptionLifecycleRelationship(
      [A],
      [],
      { stripeSubscriptionId: "sub_a", stripeCheckoutSessionId: "cs_a" },
    );
    assert.equal(target?.id, "rel_a");
  });

  it("may attach to an unpaid draft that already has this checkout session", () => {
    const draft = {
      id: "rel_draft",
      owner: { email: "new@example.com" },
      venue: { name: "New Hall" },
      stripeCheckoutSessionId: "cs_new",
    };
    const target = resolveSubscriptionLifecycleRelationship([draft], [], {
      stripeSubscriptionId: "sub_new",
      stripeCheckoutSessionId: "cs_new",
    });
    assert.equal(target?.id, "rel_draft");
  });

  it("defers when the event has no session and the draft is not yet subscribed", () => {
    const draft = {
      id: "rel_draft",
      stripeCheckoutSessionId: "cs_new",
    };
    const target = resolveSubscriptionLifecycleRelationship([draft], [], {
      stripeSubscriptionId: "sub_new",
    });
    assert.equal(target, null);
  });

  it("does not retarget an established purchase even if its session was already overwritten", () => {
    const poisoned = {
      ...A,
      stripeCheckoutSessionId: "cs_hold",
      stripeSubscriptionId: "sub_a",
    };
    const target = resolveSubscriptionLifecycleRelationship([poisoned], [], {
      stripeSubscriptionId: "sub_hold",
      stripeCheckoutSessionId: "cs_hold",
    });
    assert.equal(target, null);
  });
});

describe("purchase identity source contracts", () => {
  const ingest = readFileSync(resolve("shared/relationships/ingest.ts"), "utf8");
  const service = readFileSync(resolve("shared/relationships/service.ts"), "utf8");
  const crm = readFileSync(resolve("marketing/lib/crm/service.ts"), "utf8");
  const contact = ingest.slice(
    ingest.indexOf("export async function ingestContactForm"),
    ingest.indexOf("export async function ingestWalkthroughRequest"),
  );
  const checkoutStart = ingest.slice(
    ingest.indexOf("export async function ingestCheckoutStarted"),
    ingest.indexOf("export async function ingestSubscriptionPurchased"),
  );
  const lifecycle = ingest.slice(
    ingest.indexOf("export async function ingestSubscriptionLifecycle"),
    ingest.indexOf("export async function ingestWelcomeBackRequest"),
  );

  it("checkout start refuses to retarget an established purchase", () => {
    assert.match(checkoutStart, /checkoutStartGuard: true/);
    assert.match(service, /checkoutStartGuard && !opts\.purchaseMatch/);
    assert.match(service, /isEstablishedPurchaseRelationship/);
  });

  it("subscription lifecycle does not email-match and does not create a purchase", () => {
    assert.match(lifecycle, /resolveSubscriptionLifecycleRelationship/);
    assert.match(lifecycle, /if \(!existingRel\) \{\s*return null;/);
    assert.doesNotMatch(lifecycle, /email: input\.email/);
    assert.match(lifecycle, /updateOnly: true/);
  });

  it("inquiry contact ingest still uses the non-purchase path", () => {
    assert.doesNotMatch(contact, /purchaseMatch/);
    assert.doesNotMatch(contact, /checkoutStartGuard/);
    const findStart = service.indexOf("function findExisting(");
    const findBody = service.slice(findStart, service.indexOf("function absorbStripeDrafts("));
    assert.match(findBody, /Email is the strongest identity signal/);
  });

  it("hold persists before onboarding and does not reuse the old token", () => {
    const hold = crm.slice(crm.indexOf("if (synced.purchaseHold)"), crm.indexOf("if (!existing)"));
    assert.match(hold, /purchaseHold: true/);
    assert.match(hold, /activationToken: null/);
    assert.match(crm, /if \(result\.purchaseHold\)|synced\.purchaseHold/);
    const purchased = ingest.slice(
      ingest.indexOf("export async function ingestSubscriptionPurchased"),
      ingest.indexOf("function mapStripeStatusToLocal"),
    );
    const holdReturn = purchased.indexOf("if (result.purchaseHold)");
    const onboard = purchased.indexOf("await enterOnboardingAfterPurchase");
    assert.ok(holdReturn > 0 && onboard > holdReturn);
  });

  it("activation replay immutability migration remains on HEAD", () => {
    const replay = readFileSync(
      resolve("supabase/migrations/20261412600000_activation_replay_ownership_immutable.sql"),
      "utf8",
    );
    const activatedAt = replay.indexOf("if v_enrollment.status = 'activated'");
    const updateAt = replay.indexOf("set purchaser_is_owner = v_purchaser_is_owner");
    assert.ok(activatedAt > 0 && updateAt > activatedAt);
  });
});

describe("file-store purchase identity ordering", () => {
  const dataDir = mkdtempSync(resolve(tmpdir(), "k2-gate5-identity-"));
  process.env.HTC_CRM_STORE = "file";
  process.env.RELATIONSHIPS_DATA_PATH = dataDir;

  const email = "k2.gate5fix.file@example.com";
  const venue = "K2 Gate5fix Alpha Hall";

  function ids(rel: {
    stripeCheckoutSessionId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    activationToken?: string | null;
  }) {
    return {
      session: rel.stripeCheckoutSessionId ?? null,
      subscription: rel.stripeSubscriptionId ?? null,
      customer: rel.stripeCustomerId ?? null,
      token: rel.activationToken ?? null,
    };
  }

  it("reproduces Gate 5 ordering and keeps purchase A, hold, replay, and a different venue apart", async () => {
    const {
      ingestCheckoutStarted,
      ingestContactForm,
      ingestSubscriptionLifecycle,
      ingestSubscriptionPurchased,
    } = await import("./ingest.ts");
    const { loadLiveStore } = await import("./store.ts");

    const purchased = (session: string, subscription: string, customer: string, venueName: string) =>
      ingestSubscriptionPurchased({
        email,
        venueName,
        firstName: "Gate",
        lastName: "Five",
        plan: "gather",
        foundingMember: false,
        welcomeBackRequested: false,
        onboardingType: "self_guided",
        stripeCheckoutSessionId: session,
        stripeSubscriptionId: subscription,
        stripeCustomerId: customer,
        subscriptionStatus: "active",
      });

    const started = await ingestCheckoutStarted({
      email,
      venueName: venue,
      plan: "gather",
      checkoutSessionId: "cs_a",
    });
    assert.equal(started?.created, true);
    assert.equal(started?.relationship.stripeCheckoutSessionId, "cs_a");
    assert.equal(started?.relationship.stripeSubscriptionId ?? null, null);

    const earlySub = await ingestSubscriptionLifecycle({
      email,
      venueName: venue,
      stripeCustomerId: "cus_a",
      stripeSubscriptionId: "sub_a",
      stripeStatus: "active",
      allowCreate: true,
    });
    assert.equal(earlySub, null);

    const purchaseA = await purchased("cs_a", "sub_a", "cus_a", venue);
    assert.equal(purchaseA.purchaseHold ?? false, false);
    assert.equal(purchaseA.relationship.stripeCheckoutSessionId, "cs_a");
    assert.equal(purchaseA.relationship.stripeSubscriptionId, "sub_a");
    assert.ok(purchaseA.relationship.activationToken);
    const aId = purchaseA.relationship.id;
    const aBefore = ids(purchaseA.relationship);

    const startedB = await ingestCheckoutStarted({
      venueName: venue,
      plan: "gather",
      checkoutSessionId: "cs_b",
    });
    assert.equal(startedB?.relationship.id, aId);
    assert.deepEqual(ids(startedB!.relationship), aBefore);

    const subB = await ingestSubscriptionLifecycle({
      email,
      venueName: venue,
      stripeCustomerId: "cus_b",
      stripeSubscriptionId: "sub_b",
      stripeStatus: "active",
      allowCreate: true,
    });
    assert.equal(subB, null);

    const holdB = await purchased("cs_b", "sub_b", "cus_b", venue);
    assert.equal(holdB.purchaseHold, true);
    assert.equal(holdB.relationship.id, aId);
    assert.deepEqual(ids(holdB.relationship), aBefore);

    const replayB = await purchased("cs_b", "sub_b", "cus_b", venue);
    assert.equal(replayB.purchaseHold, true);
    assert.equal(replayB.relationship.id, aId);

    const afterHold = await loadLiveStore();
    const stillA = afterHold.relationships.find((r) => r.id === aId);
    assert.ok(stillA);
    assert.deepEqual(ids(stillA), aBefore);
    assert.equal(afterHold.relationships.filter((r) => r.owner.email === email).length, 1);
    assert.equal(
      afterHold.subscriptions.filter((s) => s.stripeSubscriptionId === "sub_b").length,
      0,
    );
    assert.equal(
      afterHold.timelineEvents.filter(
        (e) => e.relationshipId === aId && e.meta?.checkout_session_id === "cs_b",
      ).length,
      0,
    );

    const startedC = await ingestCheckoutStarted({
      email,
      venueName: "K2 Gate5fix Bravo Hall",
      plan: "gather",
      checkoutSessionId: "cs_c",
    });
    assert.equal(startedC?.relationship.id, aId);
    assert.deepEqual(ids(startedC!.relationship), aBefore);

    const purchaseC = await purchased("cs_c", "sub_c", "cus_c", "K2 Gate5fix Bravo Hall");
    assert.equal(purchaseC.purchaseHold ?? false, false);
    assert.notEqual(purchaseC.relationship.id, aId);
    assert.equal(purchaseC.relationship.stripeCheckoutSessionId, "cs_c");
    assert.equal(purchaseC.relationship.stripeSubscriptionId, "sub_c");
    assert.ok(purchaseC.relationship.activationToken);
    assert.notEqual(purchaseC.relationship.activationToken, aBefore.token);

    const replayA = await purchased("cs_a", "sub_a", "cus_a", venue);
    assert.equal(replayA.purchaseHold ?? false, false);
    assert.equal(replayA.relationship.id, aId);
    assert.deepEqual(ids(replayA.relationship), aBefore);

    const [left, right] = await Promise.all([
      purchased("cs_c", "sub_c", "cus_c", "K2 Gate5fix Bravo Hall"),
      purchased("cs_c", "sub_c", "cus_c", "K2 Gate5fix Bravo Hall"),
    ]);
    assert.equal(left.relationship.id, purchaseC.relationship.id);
    assert.equal(right.relationship.id, purchaseC.relationship.id);

    const finalStore = await loadLiveStore();
    const finalA = finalStore.relationships.find((r) => r.id === aId);
    assert.ok(finalA);
    assert.deepEqual(ids(finalA), aBefore);
    assert.equal(
      finalStore.relationships.filter((r) => r.stripeCheckoutSessionId === "cs_c").length,
      1,
    );

    const inquiryEmail = "k2.gate5fix.inquiry@example.com";
    const firstInquiry = await ingestContactForm({
      email: inquiryEmail,
      name: "Inquiry Person",
      venueName: "Inquiry Hall",
      message: "first",
    });
    const secondInquiry = await ingestContactForm({
      email: inquiryEmail,
      name: "Inquiry Person",
      venueName: "Inquiry Hall Renamed",
      message: "second",
    });
    assert.equal(secondInquiry.relationship.id, firstInquiry.relationship.id);
    assert.equal(secondInquiry.created, false);
  });
});

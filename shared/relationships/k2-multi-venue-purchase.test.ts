import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  decidePurchaseMatch,
  type PurchaseIdentity,
} from "./service";
import {
  resolveWelcomeEmailAttempt,
  welcomeBatchSucceeded,
} from "./welcome-email";

function rel(partial: PurchaseIdentity): PurchaseIdentity {
  return partial;
}

const sally = rel({
  id: "rel_sally",
  owner: { email: "owner@example.com" },
  venue: { name: "Sally Sunshine Events" },
  stripeCheckoutSessionId: "cs_sally",
  stripeSubscriptionId: "sub_sally",
  activationToken: "act_sally",
});

describe("K2 purchase match", () => {
  it("A/D same session reuses the purchase and does not rotate identity", () => {
    const decision = decidePurchaseMatch([sally], [], {
      email: "owner@example.com",
      venueName: "Sally Sunshine Events",
      stripeCheckoutSessionId: "cs_sally",
      stripeSubscriptionId: "sub_sally",
    });
    assert.equal(decision.action, "reuse");
    if (decision.action === "reuse") {
      assert.equal(decision.via, "session");
      assert.equal(decision.relationship.activationToken, "act_sally");
      assert.equal(decision.relationship.id, "rel_sally");
    }
  });

  it("B/C different venue name and a new session creates", () => {
    const second = decidePurchaseMatch([sally], [], {
      email: "owner@example.com",
      venueName: "Daisy Farm & Barn",
      stripeCheckoutSessionId: "cs_daisy",
      stripeSubscriptionId: "sub_daisy",
    });
    assert.equal(second.action, "create");

    const third = decidePurchaseMatch(
      [sally, rel({
        id: "rel_daisy",
        owner: { email: "owner@example.com" },
        venue: { name: "Daisy Farm & Barn" },
        stripeCheckoutSessionId: "cs_daisy",
        stripeSubscriptionId: "sub_daisy",
        activationToken: "act_daisy",
      })],
      [],
      {
        email: "owner@example.com",
        venueName: "Cedar Hall",
        stripeCheckoutSessionId: "cs_cedar",
        stripeSubscriptionId: "sub_cedar",
      },
    );
    assert.equal(third.action, "create");
  });

  it("G/S same email and same normalized name holds without mutating Sally", () => {
    const before = {
      session: sally.stripeCheckoutSessionId,
      subscription: sally.stripeSubscriptionId,
      token: sally.activationToken,
    };
    const decision = decidePurchaseMatch([sally], [], {
      email: "OWNER@example.com",
      venueName: "sally sunshine events!",
      stripeCheckoutSessionId: "cs_sally_again",
      stripeSubscriptionId: "sub_new",
    });
    assert.equal(decision.action, "hold");
    if (decision.action === "hold") {
      assert.equal(decision.relationship, sally);
    }
    assert.equal(sally.stripeCheckoutSessionId, before.session);
    assert.equal(sally.stripeSubscriptionId, before.subscription);
    assert.equal(sally.activationToken, before.token);
  });

  it("Q session identity is not the other purchase's token", () => {
    const daisy = rel({
      id: "rel_daisy",
      owner: { email: "owner@example.com" },
      venue: { name: "Daisy Farm & Barn" },
      stripeCheckoutSessionId: "cs_daisy",
      stripeSubscriptionId: "sub_daisy",
      activationToken: "act_daisy",
    });
    const sallyReplay = decidePurchaseMatch([sally, daisy], [], {
      email: "owner@example.com",
      venueName: "Daisy Farm & Barn",
      stripeCheckoutSessionId: "cs_sally",
    });
    assert.equal(sallyReplay.action, "reuse");
    if (sallyReplay.action === "reuse") {
      assert.equal(sallyReplay.relationship.activationToken, "act_sally");
      assert.notEqual(sallyReplay.relationship.activationToken, "act_daisy");
    }
  });

  it("subscription id reuses that purchase before the venue-name rule", () => {
    const decision = decidePurchaseMatch([sally], [], {
      email: "owner@example.com",
      venueName: "Daisy Farm & Barn",
      stripeCheckoutSessionId: "cs_other",
      stripeSubscriptionId: "sub_sally",
    });
    assert.equal(decision.action, "reuse");
    if (decision.action === "reuse") assert.equal(decision.via, "subscription");
  });

  it("R findExisting stays email-first and purchase matching is a separate path", () => {
    const src = readFileSync(resolve("shared/relationships/service.ts"), "utf8");
    const findStart = src.indexOf("function findExisting(");
    const findEnd = src.indexOf("function absorbStripeDrafts(");
    const findBody = src.slice(findStart, findEnd);
    assert.match(findBody, /Email is the strongest identity signal/);
    const emailAt = findBody.indexOf("normalizeEmail(r.owner.email)");
    const sessionAt = findBody.indexOf("r.stripeCheckoutSessionId");
    assert.ok(emailAt > 0 && sessionAt > emailAt);
    assert.match(src, /purchaseMatch\?: boolean/);
    assert.match(src, /decision\.action === "hold"/);
    assert.match(src, /stripeCustomerId: undefined/);
    const ingest = readFileSync(resolve("shared/relationships/ingest.ts"), "utf8");
    assert.match(ingest, /purchaseMatch: true/);
    assert.match(ingest, /if \(result\.purchaseHold\)/);
    const contact = ingest.slice(
      ingest.indexOf("export async function ingestContactForm"),
      ingest.indexOf("export async function ingestWalkthroughRequest"),
    );
    assert.doesNotMatch(contact, /purchaseMatch/);
  });
});

describe("K2 welcome email marker", () => {
  const now = Date.parse("2026-10-05T12:00:00.000Z");

  it("first send is allowed when no marker exists", () => {
    assert.equal(
      resolveWelcomeEmailAttempt({ sentAt: null, claimedAt: null, now }),
      "send",
    );
  });

  it("replay after a successful send does not send again", () => {
    assert.equal(
      resolveWelcomeEmailAttempt({
        sentAt: "2026-10-05T11:00:00.000Z",
        claimedAt: null,
        now,
      }),
      "skip_sent",
    );
  });

  it("an in-flight claim blocks a duplicate and a stale claim can retry", () => {
    assert.equal(
      resolveWelcomeEmailAttempt({
        sentAt: null,
        claimedAt: "2026-10-05T11:55:00.000Z",
        now,
      }),
      "skip_in_flight",
    );
    assert.equal(
      resolveWelcomeEmailAttempt({
        sentAt: null,
        claimedAt: "2026-10-05T11:40:00.000Z",
        now,
      }),
      "send",
    );
  });

  it("marks sent only after the welcome transport reports sent", () => {
    assert.equal(
      welcomeBatchSucceeded([{ templateId: "welcome", ok: true, delivery: "sent" }]),
      true,
    );
    assert.equal(
      welcomeBatchSucceeded([{ templateId: "welcome", ok: true, delivery: "simulated" }]),
      false,
    );
    assert.equal(
      welcomeBatchSucceeded([{ templateId: "welcome", ok: false, delivery: "failed" }]),
      false,
    );
    assert.equal(welcomeBatchSucceeded([]), false);
  });
});

describe("K2 provisioning, activation, webhook, and schema", () => {
  const workspace = readFileSync(resolve("lib/provisioning/workspace.ts"), "utf8");
  const activateRoute = readFileSync(
    resolve("app/api/internal/enrollment/activate/route.ts"),
    "utf8",
  );
  const webhook = readFileSync(
    resolve("marketing/app/api/stripe/webhook/route.ts"),
    "utf8",
  );
  const upsert = readFileSync(
    resolve("app/api/internal/enrollment/upsert/route.ts"),
    "utf8",
  );
  const migration = readFileSync(
    resolve("supabase/migrations/20261412500000_k2_multi_venue_purchase.sql"),
    "utf8",
  );
  const bySession = readFileSync(
    resolve("app/api/internal/enrollment/by-session/route.ts"),
    "utf8",
  );
  const milestones = readFileSync(
    resolve("shared/relationships/product-milestones.ts"),
    "utf8",
  );

  it("workspace creates a venue only through the shared enrollment operation", () => {
    assert.match(workspace, /provision_enrollment_venue/);
    assert.doesNotMatch(workspace, /\.eq\("owner_user_id"/);
    assert.doesNotMatch(workspace, /from\("venues"\)/);
    assert.doesNotMatch(workspace, /from\("venue_staff"\)/);
  });

  it("activation does not insert a venue and does not reset an existing password", () => {
    const activateFn = migration.slice(
      migration.indexOf("create or replace function public.activate_venue_enrollment("),
      migration.indexOf("create or replace function public.activate_venue_enrollment(\n  p_activation_token text,\n  p_owner_user_id uuid\n)"),
    );
    assert.doesNotMatch(activateFn, /insert into public\.venues/);
    assert.match(activateFn, /provision_enrollment_venue/);
    assert.match(activateFn, /if p_purchaser_is_owner is null then/);
    assert.doesNotMatch(activateFn, /coalesce\s*\(\s*p_purchaser_is_owner/);
    assert.match(activateRoute, /alreadyHasLogin/);
    assert.match(activateRoute, /enrollment\.status === "activated"/);
    assert.match(activateRoute, /parseExplicitPurchaserIsOwner/);
  });

  it("two provisions of one enrollment are serialized on the enrollment row", () => {
    const provision = migration.slice(
      migration.indexOf("create or replace function public.provision_enrollment_venue"),
      migration.indexOf("revoke all on function public.provision_enrollment_venue"),
    );
    assert.match(provision, /for update/);
    assert.equal(provision.match(/insert into public\.venues/g)?.length, 1);
    assert.match(provision, /if v_enrollment\.venue_id is not null then/);
    assert.doesNotMatch(provision, /where owner_user_id/);
    assert.match(provision, /unique_violation/);
    const insertAt = provision.indexOf("insert into public.venues");
    const reuseAt = provision.indexOf("if v_enrollment.venue_id is not null");
    assert.ok(reuseAt > 0 && reuseAt < insertAt);
  });

  it("drops venues_owner_unique only after the scalar lookups are rewritten", () => {
    const dropAt = migration.lastIndexOf("drop index if exists public.venues_owner_unique");
    for (const name of [
      "get_notification_preferences",
      "update_notification_preferences",
      "get_reminder_cadence",
      "update_reminder_cadence",
      "complete_venue_setup",
      "get_venue_analytics",
      "get_client_health_scores",
      "get_luv_rollups",
      "save_luv_rollup",
      "search_global",
      "get_actor_context",
      "send_anniversary_message",
      "update_referral_status",
      "approve_couple_memory",
      "get_venue_notifications",
      "mark_notifications_read",
    ]) {
      const at = migration.indexOf(`function public.${name}`);
      assert.ok(at > 0 && at < dropAt, name);
    }
    assert.match(migration, /v_venue_id := public\.current_user_venue_id\(\)/);
    assert.match(migration, /active_venue_required/);
    assert.doesNotMatch(
      migration.slice(migration.indexOf("function public.get_actor_context")),
      /from public\.venues\s+where owner_user_id = auth\.uid\(\) limit 1/,
    );
  });

  it("webhook retries only when the purchase was not durably stored", () => {
    const handler = webhook.slice(
      webhook.indexOf("async function handleCheckoutCompleted"),
      webhook.indexOf("async function handleSubscriptionLifecycle"),
    );
    assert.match(handler, /throw error/);
    const crm = readFileSync(resolve("marketing/lib/crm/service.ts"), "utf8");
    assert.match(crm, /purchaseHold/);
    assert.match(crm, /recordWelcomeEmailSent/);
    assert.match(crm, /releaseWelcomeEmailClaim/);
    assert.doesNotMatch(
      crm.slice(crm.indexOf("if (emailAttempt === \"send\")"), crm.indexOf("enqueueProductSync")),
      /throw new Error/,
    );
  });

  it("upsert refuses a token that belongs to another enrollment", () => {
    assert.match(upsert, /activation_token_belongs_to_another_enrollment/);
    assert.match(upsert, /purchase_hold/);
    assert.match(upsert, /welcome_email_sent_at/);
  });

  it("P success lookup is session-specific", () => {
    assert.match(bySession, /\.eq\("stripe_checkout_session_id", sessionId\)/);
    assert.doesNotMatch(bySession, /owner_email/);
    assert.doesNotMatch(bySession, /customerEmail/);
  });

  it("product venue bind prefers the purchase relationship over a shared email", () => {
    const fn = milestones.slice(
      milestones.indexOf("export async function bindCrmProductVenueId"),
      milestones.indexOf("export async function", milestones.indexOf("bindCrmProductVenueId") + 10),
    );
    const relationshipAt = fn.indexOf("input.relationshipId?.trim()");
    const sessionAt = fn.indexOf("input.stripeCheckoutSessionId?.trim()");
    const emailAt = fn.indexOf("input.ownerEmail?.trim()");
    assert.ok(relationshipAt > 0 && sessionAt > relationshipAt && emailAt > sessionAt);
    assert.match(fn, /matches\.length === 1/);
  });
});

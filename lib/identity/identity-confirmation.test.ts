import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { identityRpcFields, requireIdentityDecision, samePrimaryName } from "@/lib/identity/decision";
import { signalsAgainstRecord } from "@/lib/leads/duplicate-detection";

const read = (p: string) => readFileSync(resolve(p), "utf8");

describe("Identity confirmation — matching is not merging", () => {
  it("same email + different name pair does not count as a safe name reuse", () => {
    assert.equal(
      samePrimaryName(
        { firstName: "Colby", lastName: "SpineE2E3" },
        { firstName: "Ellie", lastName: "Yagnesak" },
      ),
      false,
    );
    const signals = signalsAgainstRecord(
      { firstName: "Colby", lastName: "SpineE2E3", email: "shared@example.com" },
      { firstName: "Ellie", lastName: "Yagnesak", email: "shared@example.com" },
    );
    assert.deepEqual(signals, ["email"]);
    assert.ok(!signals.includes("name_pair"));
  });

  it("venue Create new customer sends createNewRelationship and not a reuse id", () => {
    assert.deepEqual(identityRpcFields({ action: "create_new" }), { createNewRelationship: true });
  });

  it("venue Use existing customer sends the chosen relationship id", () => {
    assert.deepEqual(
      identityRpcFields({ action: "use_existing", relationshipId: "rel-ellie" }),
      { relationshipId: "rel-ellie", createNewRelationship: false },
    );
  });

  it("possible matches without a decision are a required review, not a silent merge", () => {
    const matches = [{
      leadId: "l1",
      clientId: null,
      relationshipId: "rel-a",
      displayName: "Ellie Yagnesak",
      email: "shared@example.com",
      phone: null,
      salesStage: "new_inquiry",
      signals: ["email" as const],
    }];
    const blocked = requireIdentityDecision(matches, null);
    assert.equal(blocked.ok, false);
    assert.equal(requireIdentityDecision(matches, { action: "create_new" }).ok, true);
    assert.equal(
      requireIdentityDecision(matches, { action: "use_existing", relationshipId: "rel-a" }).ok,
      true,
    );
  });

  it("same primary name + email is a safe returning-customer name match", () => {
    assert.equal(
      samePrimaryName(
        { firstName: "Ellie", lastName: "Yagnesak" },
        { firstName: "Ellie", lastName: "Yagnesak" },
      ),
      true,
    );
  });

  it("phone-only and partner-email-only are review signals, not identity", () => {
    assert.deepEqual(
      signalsAgainstRecord(
        { firstName: "A", lastName: "One", phone: "6155551212" },
        { firstName: "B", lastName: "Two", phone: "6155551212" },
      ),
      ["phone"],
    );
    assert.deepEqual(
      signalsAgainstRecord(
        { firstName: "A", lastName: "One", partnerEmail: "p@example.com" },
        { firstName: "B", lastName: "Two", email: "p@example.com" },
      ),
      ["partner_email"],
    );
  });

  it("name-pair is a duplicate-review signal and not a silent merge key in SQL", () => {
    const signals = signalsAgainstRecord(
      {
        firstName: "Ellie",
        lastName: "Yagnesak",
        partnerFirstName: "Hunter",
        partnerLastName: "Smith",
      },
      {
        firstName: "Hunter",
        lastName: "Smith",
        partnerFirstName: "Ellie",
        partnerLastName: "Yagnesak",
      },
    );
    assert.deepEqual(signals, ["name_pair"]);
    const resolver = read("supabase/migrations/20261399000000_identity_confirmation_relationships.sql");
    const fn = resolver.slice(resolver.indexOf("create or replace function public.find_or_create_relationship"));
    const body = fn.slice(0, fn.indexOf("create or replace function public.resolve_relationship_for_identity"));
    assert.match(body, /lower\(first_name\) = lower\(v_first\)/);
    assert.match(body, /lower\(email\) = lower\(v_email\)/);
    assert.doesNotMatch(body, /partner_email|partner_first/);
    assert.doesNotMatch(body, /phone/);
  });
});

describe("Identity confirmation — production create paths", () => {
  it("create_client_atomic no longer reuses on email-only", () => {
    const sql = read("supabase/migrations/20261399000000_identity_confirmation_relationships.sql");
    const fn = sql.slice(sql.indexOf("create or replace function public.create_client_atomic"));
    assert.match(fn, /resolve_relationship_for_identity/);
    assert.match(fn, /createNewRelationship/);
    assert.doesNotMatch(
      fn.slice(fn.indexOf("if v_rel_id is null"), fn.indexOf("insert into public.clients")),
      /lower\(email\) = lower\(v_email\)\s+limit 1/,
    );
  });

  it("ingest_lead honors explicit use-existing / create-new", () => {
    const sql = read("supabase/migrations/20261399000000_identity_confirmation_relationships.sql");
    const fn = sql.slice(sql.indexOf("create or replace function public.ingest_lead"));
    assert.match(fn, /createNewRelationship/);
    assert.match(fn, /relationshipId/);
    assert.match(fn, /resolve_relationship_for_identity/);
  });

  it("venue Direct Add and manual Lead require identity_review_required when matches exist", () => {
    const clients = read("lib/clients/service.ts");
    const leads = read("lib/leads/service.ts");
    assert.match(clients, /identity_review_required/);
    assert.match(clients, /requireIdentityDecision/);
    assert.match(leads, /identity_review_required/);
    assert.match(leads, /trustTier === "manual"/);
  });

  it("Lead → Client conversion inherits the lead relationship, not email lookup", () => {
    const sql = read("supabase/migrations/20261399000000_identity_confirmation_relationships.sql");
    const fn = sql.slice(sql.indexOf("create or replace function public.create_client_atomic"));
    assert.match(fn, /if v_lead_id is not null then/);
    assert.match(fn, /select relationship_id into v_rel_id/);
    assert.match(fn, /from public\.leads/);
  });

  it("Direct Add UI presents Use existing / Create new and passes the decision", () => {
    const form = read("components/clients/client-form.tsx");
    const dlg = read("components/leads/possible-match-create-dialog.tsx");
    assert.match(form, /onDecide/);
    assert.match(form, /identityDecision: decision/);
    assert.match(dlg, /Use existing customer/);
    assert.match(dlg, /Create new customer/);
  });

  it("unique email is no longer an identity constraint", () => {
    const sql = read("supabase/migrations/20261399000000_identity_confirmation_relationships.sql");
    assert.match(sql, /drop index if exists public\.venue_customer_relationships_venue_email/);
    assert.match(sql, /venue_customer_relationships_venue_email_lookup/);
  });
});

describe("Identity confirmation — inbound and portal", () => {
  it("inbound email store refuses a hidden limit-1 identity pick across customers", () => {
    const route = read("app/api/messaging/inbound/route.ts");
    const fn = route.slice(route.indexOf("async findLeadByEmail"));
    assert.match(fn, /rels\.size/);
    assert.doesNotMatch(fn.slice(0, fn.indexOf("async findClientByEmail")), /\.limit\(1\)/);
  });

  it("inbound SMS refuses to choose when more than one relationship shares the phone", () => {
    const sql = read("supabase/migrations/20261400000000_find_relationship_by_phone_unique_only.sql");
    const fn = sql.slice(sql.indexOf("create or replace function public.find_relationship_by_phone_for_venue"));
    assert.match(fn, /array_agg\(distinct x\.relationship_id\)/);
    assert.match(fn, /cardinality\(v_rels\) is distinct from 1/);
    assert.doesNotMatch(fn, /min\(/);
    const countFn = sql.slice(sql.indexOf("create or replace function public.count_relationships_by_phone_for_venue"));
    assert.match(countFn, /count\(distinct x\.relationship_id\)/);
  });

  it("each new relationship still provisions one venue_couple conversation", () => {
    const foundation = read(
      "supabase/migrations/20260719000000_program2_phase2_relationship_and_conversation_foundation.sql",
    );
    assert.match(foundation, /venue_customer_relationships_provision_conversation/);
  });

  it("portal messages resolve through the client relationship venue_couple thread", () => {
    const portal = read("lib/conversations/venue-couple-portal-routing.test.ts");
    assert.match(portal, /get_portal_conversation requires conversation_kind = venue_couple/);
    const mig = read("supabase/migrations/20261391000000_portal_venue_couple_channel.sql");
    assert.match(mig, /relationship_id = v_relationship_id/);
    assert.match(mig, /conversation_kind = 'venue_couple'/);
  });

  it("couple_vendor_inquiry remains excluded from couple portal Messages", () => {
    const mig = read("supabase/migrations/20261391000000_portal_venue_couple_channel.sql");
    assert.match(mig, /conversation_kind = 'venue_couple'/);
    assert.doesNotMatch(
      mig.slice(mig.indexOf("create or replace function public.get_portal_conversation")),
      /couple_vendor_inquiry/,
    );
  });
});

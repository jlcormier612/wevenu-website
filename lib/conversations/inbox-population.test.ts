import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { inboxWorkingCategory } from "@/lib/conversations/inbox-working-population";
import { isOpenLeadLifecycle } from "@/lib/leads/open-lifecycle";

const migration = readFileSync(
  resolve("supabase/migrations/20261402700000_inbox_active_lifecycle_population.sql"),
  "utf8",
);

describe("inbox active lifecycle population", () => {
  it("Inbox Leads is the open sales lead, not every lead-stamped conversation", () => {
    assert.match(migration, /p_relationship in \('leads', 'lead'\)/);
    assert.match(migration, /not in \('booked', 'lost', 'won', 'cancelled'\)/);
    assert.doesNotMatch(
      migration.slice(migration.indexOf("p_relationship in ('leads', 'lead')")),
      /coalesce\(e\.inbox_owner_kind, 'lead'\) = 'lead'/,
    );
    assert.equal(isOpenLeadLifecycle("proposal_sent"), true);
    assert.equal(isOpenLeadLifecycle("booked"), false);
    assert.equal(isOpenLeadLifecycle("lost"), false);
    assert.equal(isOpenLeadLifecycle("cancelled"), false);
  });

  it("Inbox Clients is a booked non-cancelled client with no open lead", () => {
    const clients = migration.slice(migration.indexOf("Inbox Clients"));
    assert.match(clients, /cl\.status is distinct from 'cancelled'/);
    assert.match(clients, /cl\.lifecycle_booked_at is not null/);
    assert.match(clients, /ev\.booked_at is not null/);
    assert.match(clients, /not exists/);
  });

  it("header unread and needs_response are independent and use the working population", () => {
    const totals = migration.slice(migration.indexOf("'total_unread'"));
    assert.match(totals, /sum\(c\.venue_unread\)/);
    assert.match(totals, /c\.needs_response/);
    assert.match(migration, /inbox_conversation_in_working_population\(c\.id\)/);
    assert.doesNotMatch(
      totals,
      /where venue_id = v_venue_id and relationship_id is not null\s*\)/,
    );
    const unreadBlock = totals.slice(0, totals.indexOf("'total_needs_response'"));
    assert.doesNotMatch(unreadBlock, /needs_response/);
  });

  it("resolves a relationship name when no lead or client name exists", () => {
    assert.match(migration, /venue_customer_relationships r/);
    assert.match(migration, /nullif\(trim\(coalesce\(r\.first_name/);
  });

  it("does not delete or duplicate conversation history as part of the filter", () => {
    assert.doesNotMatch(migration, /delete from public\.conversations/i);
    assert.doesNotMatch(migration, /delete from public\.conversation_messages/i);
    assert.doesNotMatch(migration, /insert into public\.conversations/i);
    assert.match(migration, /conversation_messages cm0/);
  });

  it("deep link uses the lifecycle classifier, not the owner stamp", () => {
    const action = readFileSync(resolve("app/(app)/messaging/actions.ts"), "utf8");
    const fn = action.slice(action.indexOf("export async function resolveInboxCategoryAction"));
    assert.match(fn, /inboxWorkingCategory/);
    assert.match(fn, /sales_stage/);
    assert.match(fn, /lifecycle_booked_at/);
    assert.doesNotMatch(fn, /inboxCategoryFromConversation/);
  });
});

describe("inbox working category", () => {
  it("active lead conversation is Inbox Leads", () => {
    assert.equal(
      inboxWorkingCategory({ hasLead: true, salesStage: "proposal_sent" }),
      "leads",
    );
  });

  it("a lead with no conversation is not an inbox row", () => {
    assert.equal(inboxWorkingCategory({ hasLead: false }), "historical");
  });

  it("booked conversation is Clients and not active Leads", () => {
    assert.equal(
      inboxWorkingCategory({
        hasLead: true,
        salesStage: "booked",
        clientStatus: "booked",
        lifecycleBookedAt: "2026-09-19T00:00:00Z",
      }),
      "clients",
    );
  });

  it("open lead wins over a premature client stamp", () => {
    assert.equal(
      inboxWorkingCategory({
        hasLead: true,
        salesStage: "new_inquiry",
        clientStatus: "booking",
        lifecycleBookedAt: null,
      }),
      "leads",
    );
  });

  it("lost conversation is not an active Inbox Lead", () => {
    assert.equal(
      inboxWorkingCategory({ hasLead: true, salesStage: "lost" }),
      "historical",
    );
  });

  it("cancelled client is not an active Inbox Client", () => {
    assert.equal(
      inboxWorkingCategory({
        hasLead: true,
        salesStage: "cancelled",
        clientStatus: "cancelled",
        lifecycleBookedAt: "2026-09-01T00:00:00Z",
      }),
      "historical",
    );
  });

  it("relationship-only certification thread is not an active tab", () => {
    assert.equal(inboxWorkingCategory({ hasLead: false }), "historical");
  });

  it("vendor threads stay Vendors", () => {
    assert.equal(
      inboxWorkingCategory({ conversationKind: "couple_vendor_inquiry", hasLead: false }),
      "vendors",
    );
  });

  it("booked event without lifecycle stamp is still Clients", () => {
    assert.equal(
      inboxWorkingCategory({
        hasLead: false,
        clientStatus: "active",
        hasBookedEvent: true,
      }),
      "clients",
    );
  });
});

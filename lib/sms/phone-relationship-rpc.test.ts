import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  inboundFromDigits,
  unmatchedReasonFromCount,
} from "@/lib/sms/inbound-unmatched";
import { isTextingConversationKind, TEXTING_KIND_BLOCKED_MESSAGE } from "@/lib/conversations/texting";

describe("phone relationship RPC — unique match only", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/20261400000000_find_relationship_by_phone_unique_only.sql"),
    "utf8",
  );

  it("replaces min(uuid) with a unique-only array_agg", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.find_relationship_by_phone_for_venue"));
    assert.match(fn, /array_agg\(distinct x\.relationship_id\)/);
    assert.match(fn, /if v_rels is null or cardinality\(v_rels\) is distinct from 1 then/);
    assert.doesNotMatch(fn, /min\(/);
    assert.match(fn, /v_rel := v_rels\[1\]/);
  });

  it("exposes a distinct-count helper without picking a winner", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.count_relationships_by_phone_for_venue"));
    const body = fn.slice(0, fn.indexOf("create or replace function public.find_relationship_by_phone_for_venue"));
    assert.match(body, /count\(distinct x\.relationship_id\)/);
    assert.match(sql, /grant execute on function public.count_relationships_by_phone_for_venue\(text, uuid\) to service_role/);
    assert.match(sql, /grant execute on function public.find_relationship_by_phone_for_venue\(text, uuid\) to service_role/);
    assert.match(sql, /revoke all on function public.count_relationships_by_phone_for_venue\(text, uuid\) from authenticated/);
  });

  it("persists unmatched inbound without creating a relationship", () => {
    assert.match(sql, /create table if not exists public.inbound_sms_unmatched/);
    assert.match(sql, /reason in \('none', 'ambiguous', 'invalid_phone', 'rpc_error'\)/);
    const inbound = readFileSync(resolve("app/api/messaging/sms-inbound/route.ts"), "utf8");
    assert.match(inbound, /persistInboundSmsUnmatched/);
    assert.doesNotMatch(
      inbound.slice(inbound.indexOf("if (matchError || !match)"), inbound.indexOf("const conversationId")),
      /findOrCreateVenueCoupleConversation/,
    );
  });
});

describe("unmatched inbound reason mapping", () => {
  it("maps count 0 to none, >1 to ambiguous, and missing to rpc_error", () => {
    assert.equal(unmatchedReasonFromCount(0), "none");
    assert.equal(unmatchedReasonFromCount(1), "none");
    assert.equal(unmatchedReasonFromCount(2), "ambiguous");
    assert.equal(unmatchedReasonFromCount(null), "rpc_error");
    assert.equal(unmatchedReasonFromCount(-1), "rpc_error");
    assert.equal(inboundFromDigits("+1 (615) 555-1212"), "6155551212");
  });
});

describe("Text is venue_couple only", () => {
  it("accepts venue_couple and refuses inquiry/vendor kinds", () => {
    assert.equal(isTextingConversationKind("venue_couple"), true);
    assert.equal(isTextingConversationKind("couple_vendor_inquiry"), false);
    assert.equal(isTextingConversationKind("venue_vendor"), false);
    assert.equal(isTextingConversationKind("couple_vendor"), false);
    assert.equal(isTextingConversationKind(null), false);
    assert.match(TEXTING_KIND_BLOCKED_MESSAGE, /conversations with a couple/);
  });
});

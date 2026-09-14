import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isClientVisibleChannel } from "@/lib/conversations/channels";

/** Live portal conversation RPC definition (supersedes earlier migrations). */
const MIGRATION = resolve("supabase/migrations/20261391000000_portal_venue_couple_channel.sql");
const STAFF_ONLY = resolve("supabase/migrations/20261315000000_staff_only_conversation_channels.sql");
const VENUE_GET = resolve("supabase/migrations/20261112000000_rc2_conversation_attachments.sql");

describe("internal notes stay off client conversation APIs", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const staffSql = readFileSync(STAFF_ONLY, "utf8");

  it("keeps internal_note out of couple and vendor conversation retrieval", () => {
    assert.match(sql, /create or replace function public\.get_portal_conversation/);
    assert.match(staffSql, /create or replace function public\.get_vendor_conversation\(/);
    assert.match(staffSql, /create or replace function public\.get_portal_couple_vendor_conversation\(/);
    const portalFn = sql.slice(sql.indexOf("create or replace function public.get_portal_conversation"));
    const portalBody = portalFn.slice(0, portalFn.indexOf("create or replace function public.send_portal_conversation_message"));
    assert.match(portalBody, /cm\.channel not in \('internal_note', 'phone_log', 'voicemail', 'push'\)/);
    assert.match(portalBody, /conversation_kind = 'venue_couple'/);
  });

  it("does not increment client unread for internal notes", () => {
    const touch = staffSql.slice(
      staffSql.indexOf("create or replace function public.touch_conversation_on_message"),
      staffSql.indexOf("create or replace function public.get_portal_conversation"),
    );
    assert.match(touch, /if new\.channel in \('internal_note', 'phone_log', 'voicemail', 'push'\)/);
    assert.match(touch, /last_message_at = new\.sent_at/);
    assert.doesNotMatch(
      touch.slice(touch.indexOf("if new.channel in"), touch.indexOf("select conversation_kind")),
      /contact_unread/,
    );
  });

  it("still lets venue staff read every channel, including historical internal notes", () => {
    const venueSql = readFileSync(VENUE_GET, "utf8");
    const venueFn = venueSql.slice(venueSql.indexOf("create or replace function public.get_conversation("));
    assert.match(venueFn, /from public\.conversation_messages cm\s+where cm\.conversation_id = p_conversation_id/);
    assert.doesNotMatch(venueFn, /channel not in \('internal_note'/);
  });

  it("treats internal_note as not client-visible in the shared channel helper", () => {
    assert.equal(isClientVisibleChannel("internal_note"), false);
    assert.equal(isClientVisibleChannel("email"), true);
  });
});

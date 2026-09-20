/**
 * Venue-internal notes privacy — wiring assertions.
 *
 * Product rule: venue/staff internal notes must never reach the client portal
 * (UI or API). This suite locks the critical server/RPC shapes and the
 * locked UX copy constants. Browser + Sandbox verification still required.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  INTERNAL_NOTES_LABEL,
  INTERNAL_NOTES_PRIVACY_HINT,
  NOTES_FROM_YOUR_VENUE_LABEL,
} from "@/lib/notes/internal-notes-copy";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("venue-internal notes privacy wiring", () => {
  it("get_portal_context never returns clients.internal_notes", () => {
    // Latest definition (venue contact expansion).
    const sql = read("supabase/migrations/20261164000000_portal_context_venue_contact.sql");
    assert.match(sql, /create or replace function public\.get_portal_context/);
    assert.match(sql, /'client',\s*jsonb_build_object/);
    assert.doesNotMatch(sql, /internal_notes/);
    assert.doesNotMatch(sql, /internalNotes/);
  });

  it("get_portal_tasks never returns event_tasks.notes (venue internal)", () => {
    const sql = read("supabase/migrations/20261327000000_portal_task_action_destinations.sql");
    assert.match(sql, /create or replace function public\.get_portal_tasks/);
    assert.doesNotMatch(sql, /'notes',\s*t\.notes/);
    assert.doesNotMatch(sql, /t\.notes/);
  });

  it("get_portal_payments keeps schedule notes but omits line-item notes", () => {
    const sql = read("supabase/migrations/20261403900000_portal_payments_omit_line_item_notes.sql");
    assert.match(sql, /'notes',\s*ps\.notes/);
    assert.doesNotMatch(sql, /'notes',\s*pli\.notes/);
    assert.doesNotMatch(sql, /pli\.notes/);
  });

  it("guest timeline publishing uses description, not internal te.notes", () => {
    const sql = read("supabase/migrations/20260812000000_guest_timeline_publishing.sql");
    assert.match(sql, /'description',\s*te\.description/);
    assert.doesNotMatch(sql, /'description',\s*te\.notes/);
  });

  it("couple vendor directory omits venue relationship notes", () => {
    const sql = read("supabase/migrations/20261198000000_portal_vendor_unclaimed_basics.sql");
    assert.match(sql, /Intentionally still NOT returned: vvr\.notes/);
    assert.doesNotMatch(sql, /'notes',\s*vvr\.notes/);
  });

  it("venue-internal editors use locked privacy copy", () => {
    const surfaces = [
      "components/clients/client-form.tsx",
      "components/leads/lead-detail.tsx",
      "components/events/event-detail.tsx",
      "components/playbooks/event-task-list.tsx",
      "components/vendors/vendor-form.tsx",
      "components/events/vendors/event-vendors-section.tsx",
      "components/events/timeline/timeline-entry-form.tsx",
      "components/payments/payment-schedule-detail.tsx",
      "components/tours/tour-list.tsx",
      "components/leads/relationship-card.tsx",
      "components/hq/venue-detail/support-section.tsx",
    ];
    const hintRe = new RegExp(
      INTERNAL_NOTES_PRIVACY_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    for (const rel of surfaces) {
      const src = read(rel);
      const usesConstant = src.includes("INTERNAL_NOTES_PRIVACY_HINT");
      const usesLiteral = hintRe.test(src);
      assert.ok(
        usesConstant || usesLiteral,
        `${rel} missing privacy hint (constant or literal)`,
      );
    }
    // Payment schedule notes are customer-facing — must NOT claim internal.
    const scheduleForm = read("components/payments/new-schedule-form.tsx");
    assert.match(scheduleForm, /NOTES_FROM_YOUR_VENUE_LABEL|Notes from your venue/);
    assert.doesNotMatch(scheduleForm, /visible only to your team/);
    assert.equal(INTERNAL_NOTES_LABEL, "Internal notes");
    assert.equal(NOTES_FROM_YOUR_VENUE_LABEL, "Notes from your venue");
  });

  it("Lead and Event workspace tabs are labeled Internal notes, not Notes", () => {
    for (const rel of [
      "components/leads/lead-detail.tsx",
      "components/events/event-detail.tsx",
    ]) {
      const src = read(rel);
      assert.match(src, /INTERNAL_NOTES_LABEL|Internal notes/);
      // Tab trigger must not be bare "Notes" as the only label text.
      assert.doesNotMatch(
        src,
        /<TabsTrigger value="notes">\s*\n\s*Notes\s*\n/,
      );
    }
  });
});

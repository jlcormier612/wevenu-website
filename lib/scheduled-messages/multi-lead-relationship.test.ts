import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  getMergeContextForRelationship,
  getRecipientContactForRelationship,
} from "@/lib/scheduled-messages/repository";

/**
 * A relationship may have more than one lead. Bare maybeSingle on that
 * filter returns PGRST116, and the scheduled-send processor then fails
 * with "Couldn't find who this message belongs to." before any provider
 * call. Both lead lookups must take the newest row.
 */
const LEADS = [
  {
    id: "older",
    first_name: "Older",
    last_name: "Lead",
    partner_first_name: null,
    partner_last_name: null,
    event_date: "2027-01-01",
    phone: "555-0100",
    partner_email: null,
    updated_at: "2026-10-19T18:05:20.000Z",
  },
  {
    id: "newer",
    first_name: "Newer",
    last_name: "Lead",
    partner_first_name: null,
    partner_last_name: null,
    event_date: "2027-06-12",
    phone: "555-0199",
    partner_email: "partner@mail.hellotocheers.test",
    updated_at: "2026-10-19T18:06:21.000Z",
  },
];

function fakeClient() {
  return {
    from(table: string) {
      const state: { limit: number | null; order: string | null; select: string | null } = {
        limit: null,
        order: null,
        select: null,
      };
      const builder = {
        select(columns: string) { state.select = columns; return builder; },
        eq() { return builder; },
        not() { return builder; },
        gte() { return builder; },
        in() { return builder; },
        order(column: string) { state.order = column; return builder; },
        limit(n: number) { state.limit = n; return builder; },
        async maybeSingle() {
          if (table === "venues") return { data: { name: "Sweet Daisy Barn & Farm", timezone: "America/New_York" }, error: null };
          if (table !== "leads") return { data: null, error: null };
          // PostgREST refuses to coerce multiple rows. Only an explicit
          // single-row limit avoids PGRST116.
          if (state.limit !== 1) return { data: null, error: { code: "PGRST116", message: "Cannot coerce the result to a single JSON object" } };
          const newest = [...LEADS].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
          return { data: newest, error: null };
        },
        then(resolve: (value: { data: unknown; error: null }) => void, reject?: (reason: unknown) => void) {
          builder.maybeSingle().then((result) => {
            if (table === "venue_staff" || table === "payment_schedules" || table === "payment_line_items") {
              resolve({ data: [], error: null });
              return;
            }
            resolve(result);
          }, reject);
        },
      };
      return builder;
    },
  };
}

describe("scheduled-message relationship lookup with multiple leads", () => {
  const src = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

  it("merge context takes the newest lead instead of maybeSingle on every lead", () => {
    const fn = src.slice(src.indexOf("export async function getMergeContextForRelationship"));
    const leadQuery = fn.slice(fn.indexOf('from("leads")'), fn.indexOf("if (lead)"));
    assert.match(leadQuery, /\.order\("updated_at", \{ ascending: false \}\)/);
    assert.match(leadQuery, /\.limit\(1\)/);
    assert.match(leadQuery, /\.maybeSingle</);
  });

  it("recipient contact takes the newest lead instead of maybeSingle on every lead", () => {
    const fn = src.slice(src.indexOf("export async function getRecipientContactForRelationship"));
    const leadQuery = fn.slice(fn.indexOf('from("leads")'), fn.indexOf("if (lead)"));
    assert.match(leadQuery, /\.order\("updated_at", \{ ascending: false \}\)/);
    assert.match(leadQuery, /\.limit\(1\)/);
    assert.match(leadQuery, /\.maybeSingle</);
  });

  it("resolves merge context to the newest lead when two leads share the relationship", async () => {
    const ctx = await getMergeContextForRelationship(
      fakeClient() as never,
      "venue-1",
      "rel-1",
    );
    assert.ok(ctx);
    assert.equal(ctx.clientFirstName, "Newer");
    assert.equal(ctx.clientLastName, "Lead");
    assert.equal(ctx.eventDate, "2027-06-12");
    assert.equal(ctx.venueName, "Sweet Daisy Barn & Farm");
  });

  it("resolves recipient contact to the newest lead when two leads share the relationship", async () => {
    const contact = await getRecipientContactForRelationship(fakeClient() as never, "rel-1");
    assert.equal(contact.phone, "555-0199");
    assert.equal(contact.partnerEmail, "partner@mail.hellotocheers.test");
  });
});

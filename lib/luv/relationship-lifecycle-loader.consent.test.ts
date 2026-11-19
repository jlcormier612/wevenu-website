/**
 * Loader consent wiring — mock Supabase, no live network / AI / sends.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadRelationshipLifecycleFacts } from "@/lib/luv/relationship-lifecycle-loader";

/**
 * Focused mock that returns permission rows keyed by channel|address_key.
 * List queries (clients/contracts/schedules) resolve empty; leads + permissions use maybeSingle.
 */
function mockConsentClient(input: {
  email: string | null;
  phone: string | null;
  byKey: Record<string, string | undefined>;
}) {
  const lead = {
    id: "lead-1",
    first_booked_at: null,
    lost_at: null,
    status: "new",
    sales_stage: "inquiry",
    email: input.email,
    phone: input.phone,
  };

  return {
    from(table: string) {
      let channel: string | null = null;
      let addressKey: string | null = null;
      let venueScoped = false;

      const api: {
        select: () => typeof api;
        eq: (col: string, val: unknown) => typeof api;
        in: () => typeof api;
        maybeSingle: () => Promise<{ data: unknown }>;
        then: (
          onFulfilled?: (value: { data: unknown }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise<unknown>;
      } = {
        select: () => api,
        eq: (col, val) => {
          if (col === "venue_id") venueScoped = true;
          if (col === "channel") channel = String(val);
          if (col === "address_key") addressKey = String(val);
          return api;
        },
        in: () => api,
        maybeSingle: async () => {
          if (table === "leads") {
            assert.equal(venueScoped, true);
            return { data: lead };
          }
          if (table === "communication_permissions") {
            assert.equal(venueScoped, true);
            assert.ok(channel);
            assert.ok(addressKey);
            const status = input.byKey[`${channel}|${addressKey}`];
            return { data: status ? { status } : null };
          }
          return { data: null };
        },
        then: (onFulfilled, onRejected) => {
          // Awaited list queries (clients / contracts / schedules) → empty.
          return Promise.resolve({ data: [] }).then(onFulfilled, onRejected);
        },
      };
      return api;
    },
  };
}

describe("loadRelationshipLifecycleFacts consent", () => {
  it("loads email + SMS consent from communication_permissions (venue-scoped)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: "Ada@Example.COM",
      phone: "+16155551234",
      byKey: {
        "email|ada@example.com": "opted_in",
        "sms|16155551234": "not_opted_in",
      },
    }) as any;

    const emailFacts = await loadRelationshipLifecycleFacts(supabase, "venue-a", "lead-1", {
      channel: "email",
    });
    assert.equal(emailFacts.emailConsentOk, true);
    assert.equal(emailFacts.smsConsentOk, false);
    assert.equal(emailFacts.channelConsentOk, true);

    const smsFacts = await loadRelationshipLifecycleFacts(supabase, "venue-a", "lead-1", {
      channel: "sms",
    });
    assert.equal(smsFacts.channelConsentOk, false);
  });

  it("missing address fails closed for that channel", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: null,
      phone: null,
      byKey: {},
    }) as any;
    const facts = await loadRelationshipLifecycleFacts(supabase, "venue-a", "lead-1", {
      channel: "email",
    });
    assert.equal(facts.emailConsentOk, false);
    assert.equal(facts.smsConsentOk, false);
    assert.equal(facts.channelConsentOk, false);
  });

  it("SMS opted_out / email provider_blocked fail closed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: "blocked@example.com",
      phone: "+16155559876",
      byKey: {
        "email|blocked@example.com": "provider_blocked",
        "sms|16155559876": "opted_out",
      },
    }) as any;
    const facts = await loadRelationshipLifecycleFacts(supabase, "venue-b", "lead-1");
    assert.equal(facts.emailConsentOk, false);
    assert.equal(facts.smsConsentOk, false);
  });

  it("does not invent SMS opt-in when permission row is absent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: "ok@example.com",
      phone: "+16155550000",
      byKey: {},
    }) as any;
    const facts = await loadRelationshipLifecycleFacts(supabase, "venue-c", "lead-1", {
      channel: "sms",
    });
    assert.equal(facts.emailConsentOk, true);
    assert.equal(facts.smsConsentOk, false);
    assert.equal(facts.channelConsentOk, false);
  });
});

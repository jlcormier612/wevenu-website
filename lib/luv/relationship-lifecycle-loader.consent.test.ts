/**
 * Loader consent wiring — mock Supabase, no live network / AI / sends.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadRelationshipLifecycleFacts } from "@/lib/luv/relationship-lifecycle-loader";

/**
 * Focused mock that returns permission rows keyed by channel|address_key.
 * List queries (clients/contracts/schedules) resolve empty; leads + permissions use maybeSingle.
 * Set byKey entry to { error: true } to simulate a failed permission read.
 */
function mockConsentClient(input: {
  email: string | null;
  phone: string | null;
  byKey: Record<string, string | { error: true } | undefined>;
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
      let leadId: string | null = null;

      const api: {
        select: () => typeof api;
        eq: (col: string, val: unknown) => typeof api;
        in: () => typeof api;
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
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
          if (col === "id") leadId = String(val);
          return api;
        },
        in: () => api,
        maybeSingle: async () => {
          if (table === "leads") {
            assert.equal(venueScoped, true);
            assert.ok(leadId);
            return { data: lead, error: null };
          }
          if (table === "communication_permissions") {
            assert.equal(venueScoped, true);
            assert.ok(channel);
            assert.ok(addressKey);
            const entry = input.byKey[`${channel}|${addressKey}`];
            if (entry && typeof entry === "object" && "error" in entry) {
              return { data: null, error: { message: "simulated read failure" } };
            }
            const status = typeof entry === "string" ? entry : undefined;
            return { data: status ? { status } : null, error: null };
          }
          return { data: null, error: null };
        },
        then: (onFulfilled, onRejected) => {
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

  it("email permission read error fails closed (never treat as not_opted_in when opted_out unknown)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: "opted-out@example.com",
      phone: "+16155551111",
      byKey: {
        "email|opted-out@example.com": { error: true },
        "sms|16155551111": "opted_in",
      },
    }) as any;
    const facts = await loadRelationshipLifecycleFacts(supabase, "venue-a", "lead-1", {
      channel: "email",
    });
    assert.equal(facts.emailConsentOk, false);
    assert.equal(facts.channelConsentOk, false);
    // SMS read still succeeded independently
    assert.equal(facts.smsConsentOk, true);
  });

  it("successful email query with no row keeps relationship-email policy (allowed)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: "new@example.com",
      phone: null,
      byKey: {},
    }) as any;
    const facts = await loadRelationshipLifecycleFacts(supabase, "venue-a", "lead-1", {
      channel: "email",
    });
    assert.equal(facts.emailConsentOk, true);
    assert.equal(facts.channelConsentOk, true);
  });

  it("SMS permission read error fails closed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: "ok@example.com",
      phone: "+16155552222",
      byKey: {
        "sms|16155552222": { error: true },
      },
    }) as any;
    const facts = await loadRelationshipLifecycleFacts(supabase, "venue-a", "lead-1", {
      channel: "sms",
    });
    assert.equal(facts.smsConsentOk, false);
    assert.equal(facts.channelConsentOk, false);
  });

  it("uses current lead email/phone keys — changed address does not inherit prior consent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: "new@example.com",
      phone: "+16155553333",
      byKey: {
        // Old addresses had consent; current addresses do not.
        "email|old@example.com": "opted_out",
        "sms|16155554444": "opted_in",
      },
    }) as any;
    const facts = await loadRelationshipLifecycleFacts(supabase, "venue-a", "lead-1");
    assert.equal(facts.emailConsentOk, true); // no row for new@ → not_opted_in email OK
    assert.equal(facts.smsConsentOk, false); // no row for new phone → SMS blocked
  });

  it("cross-venue isolation: permission keys are venue-scoped in the query", async () => {
    let seenVenue: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = mockConsentClient({
      email: "shared@example.com",
      phone: null,
      byKey: { "email|shared@example.com": "opted_out" },
    }) as any;
    const originalFrom = supabase.from.bind(supabase);
    supabase.from = (table: string) => {
      const chain = originalFrom(table);
      const origEq = chain.eq.bind(chain);
      chain.eq = (col: string, val: unknown) => {
        if (col === "venue_id") seenVenue = String(val);
        return origEq(col, val);
      };
      return chain;
    };
    await loadRelationshipLifecycleFacts(supabase, "venue-isolated", "lead-1");
    assert.equal(seenVenue, "venue-isolated");
  });
});

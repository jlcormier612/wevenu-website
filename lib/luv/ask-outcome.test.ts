/**
 * Luv Intelligence V1 — structured outcomes, gaps, source isolation, signals.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  defaultNextStepsForGap,
  knowledgeLayerForOutcome,
  parseLuvAskModelResponse,
  unavailableAskResponse,
} from "@/lib/luv/ask-outcome";
import { buildCoupleAskLuvSystemPrompt } from "@/lib/luv/couple-ask-prompt";
import { retrieveCoupleHtcKnowledge } from "@/lib/luv/couple-htc-knowledge";
import { buildLuvAskPortalContext } from "@/lib/luv/portal-context";
import {
  projectGuideForAudience,
  type VenueGuideRaw,
} from "@/lib/venue-guide/audience";

const ROOT = process.cwd();

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("AC-01 — Guide answer outcome", () => {
  it("parses answered_venue_guide with guideSection from model JSON", () => {
    const parsed = parseLuvAskModelResponse(
      JSON.stringify({
        answer: "Outside alcohol is not permitted.",
        guideSection: "policies",
        outcome: "answered_venue_guide",
        nextSteps: [],
      }),
    );
    assert.equal(parsed.outcome, "answered_venue_guide");
    assert.equal(parsed.guideSection, "policies");
    assert.match(parsed.answer, /Outside alcohol is not permitted/);
    assert.equal(knowledgeLayerForOutcome(parsed.outcome), "venue_guide");
  });

  it("includes published Guide policies in the prompt for grounding", () => {
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm.",
      htcHits: [],
      venueInfo: { policies: "Outside alcohol is not permitted." },
    });
    assert.match(prompt, /Outside alcohol is not permitted/);
    assert.match(prompt, /answered_venue_guide/);
    assert.match(prompt, /source: venue_guide/);
  });
});

describe("AC-02 — HTC answer", () => {
  it("retrieves couple-safe payment how-to knowledge", () => {
    const hits = retrieveCoupleHtcKnowledge("What do I do to make a payment?");
    assert.ok(hits.length > 0);
    assert.ok(hits.every((h) => h.source === "htc_product" && h.audience === "couple"));
  });

  it("prompt instructs answered_htc_help for product how-tos", () => {
    const hits = retrieveCoupleHtcKnowledge("What do I do to make a payment?");
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm.",
      htcHits: hits,
      venueInfo: {},
    });
    assert.match(prompt, /answered_htc_help/);
    assert.match(prompt, /source: htc_product/);
  });
});

describe("AC-03 — Portal context", () => {
  it("grounds next payment in portal context builder", () => {
    const portal = buildLuvAskPortalContext({
      now: new Date("2030-01-15T12:00:00.000Z"),
      schedules: [
        {
          id: "s1",
          title: "Wedding package",
          invoiceId: "inv_1",
          createdAt: "2030-01-01T00:00:00.000Z",
          lineItems: [
            {
              id: "li1",
              label: "Final Payment",
              amount: 2400,
              dueDate: "2030-12-04",
              status: "pending",
            },
          ],
        },
      ],
    });
    assert.ok(portal.payments?.nextScheduledPayment);
    assert.equal(portal.payments?.nextScheduledPayment?.amount, 2400);

    const parsed = parseLuvAskModelResponse(
      JSON.stringify({
        answer: "Your next payment is Final Payment for $2,400.00 due December 4, 2030.",
        guideSection: null,
        outcome: "answered_portal_context",
        nextSteps: [],
      }),
    );
    assert.equal(parsed.outcome, "answered_portal_context");
    assert.equal(knowledgeLayerForOutcome(parsed.outcome), "portal_context");
  });
});

describe("AC-04 / AC-05 — Information gap + next steps", () => {
  it("parses dogs question as information_gap with approved next steps", () => {
    const parsed = parseLuvAskModelResponse(
      JSON.stringify({
        answer:
          "I couldn't find a pet policy in the venue information provided here. You may want to ask the venue directly. If you'd like, I can help you phrase a quick question to send them.",
        guideSection: null,
        outcome: "information_gap",
        nextSteps: ["browse_venue_guide", "phrase_question"],
      }),
    );
    assert.equal(parsed.outcome, "information_gap");
    assert.ok(parsed.nextSteps.includes("browse_venue_guide"));
    assert.ok(parsed.nextSteps.includes("phrase_question"));
    assert.doesNotMatch(parsed.answer, /typically|most venues|usually allow/i);
    assert.equal(knowledgeLayerForOutcome(parsed.outcome), null);
  });

  it("defaults approved next steps when model omits them on a gap", () => {
    const parsed = parseLuvAskModelResponse(
      JSON.stringify({
        answer: "I couldn't find that in the venue information provided here.",
        outcome: "information_gap",
      }),
      { hasPublishedContacts: true },
    );
    assert.equal(parsed.outcome, "information_gap");
    assert.ok(parsed.nextSteps.length >= 1);
    assert.ok(parsed.nextSteps.includes("browse_venue_guide"));
    assert.ok(parsed.nextSteps.includes("phrase_question"));
    assert.ok(parsed.nextSteps.includes("contact_venue"));
  });

  it("prompt forbids invented venue policies and requires information_gap", () => {
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm.",
      htcHits: [],
      venueInfo: {},
    });
    assert.match(prompt, /information_gap/);
    assert.match(prompt, /Never invent/);
    assert.match(prompt, /Most venues/);
    assert.match(prompt, /phrase_question/);
    assert.doesNotMatch(prompt, /web search|crawl|fetch url/i);
  });
});

describe("AC-06 — Unpublished / vendor isolation", () => {
  it("hides unpublished FAQs and vendor-only sections from client projection", () => {
    const raw: VenueGuideRaw = {
      policies: null,
      faqs: [
        {
          question: "Outside alcohol?",
          answer: "Outside alcohol is not permitted.",
          published: false,
        },
        {
          question: "Pets?",
          answer: "Dogs welcome with approval.",
          published: true,
          audience: "vendors",
        },
      ],
      sectionAudiences: { policies: "vendors" },
      sectionOverrides: {
        policies: { vendors: "Vendor load-in alcohol rules (secret)." },
      },
    };
    // Put vendor-only prose on the main policies field but audience vendors
    raw.policies = "Client should never see vendor load-in alcohol rules.";

    const view = projectGuideForAudience(raw, "clients");
    assert.ok(view);
    assert.equal(view.policies, null);
    assert.equal(view.faqs.length, 0);
  });

  it("published client FAQ can produce Guide grounding content", () => {
    const view = projectGuideForAudience(
      {
        faqs: [
          {
            question: "Outside alcohol?",
            answer: "Outside alcohol is not permitted.",
            published: true,
          },
        ],
      },
      "clients",
    );
    assert.ok(view);
    assert.equal(view.faqs.length, 1);
    assert.match(view.faqs[0]!.answer, /not permitted/);
  });
});

describe("AC-07 / AC-10 — Internal + out-of-scope isolation", () => {
  it("Ask route and prompt do not wire dashboard memories, web fetch, or Guide mutation", () => {
    const route = read("app/api/portal/luv-ask/route.ts");
    const prompt = read("lib/luv/couple-ask-prompt.ts");
    const outcome = read("lib/luv/ask-outcome.ts");
    const signals = read("lib/luv/ask-signals.ts");
    const ui = read("components/portal/luv-ask-section.tsx");

    for (const src of [route, prompt, outcome, signals, ui]) {
      assert.doesNotMatch(src, /getVenueMemories|compute_venue_memories|luv_memories/);
      assert.doesNotMatch(src, /decision-engine|DecisionEngine/);
      assert.doesNotMatch(src, /fetch\(["'`]https?:\/\//);
      assert.doesNotMatch(src, /web.?search|crawlVenueWebsite/i);
      assert.doesNotMatch(src, /upsert_venue_operational_info|auto.?publish/i);
      assert.doesNotMatch(src, /sendEmail|sendSms|createTicket|escalate/i);
    }

    assert.match(route, /recordLuvAskSignal/);
    assert.match(route, /unavailableAskResponse/);
    assert.match(route, /parseLuvAskModelResponse/);
  });
});

describe("AC-08 / AC-11 — Signals + unavailable", () => {
  it("unavailable response is distinct from information_gap", () => {
    const u = unavailableAskResponse("Luv isn't available right now.");
    assert.equal(u.outcome, "unavailable");
    assert.deepEqual(u.nextSteps, []);
    assert.notEqual(u.outcome, "information_gap");
  });

  it("migration defines minimal venue-scoped signal table + token RPC", () => {
    const sql = read("supabase/migrations/20261408500000_luv_ask_signals.sql");
    assert.match(sql, /create table public\.luv_ask_signals/);
    assert.match(sql, /venue_id/);
    assert.match(sql, /client_id/);
    assert.match(sql, /relationship_id/);
    assert.match(sql, /event_id/);
    assert.match(sql, /outcome/);
    assert.match(sql, /knowledge_layer/);
    assert.match(sql, /next_steps/);
    assert.match(sql, /record_luv_ask_signal/);
    assert.match(sql, /_resolve_portal_ids/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /current_user_venue_id/);
    assert.doesNotMatch(sql, /for insert to anon/);
    assert.doesNotMatch(sql, /for all to anon/);
  });

  it("default gap next steps stay within V1 allowlist", () => {
    const steps = defaultNextStepsForGap({ hasPublishedContacts: true });
    assert.ok(steps.every((s) =>
      ["browse_venue_guide", "contact_venue", "phrase_question", "open_payments", "open_documents"].includes(s),
    ));
  });
});

describe("AC-09 — Tenant isolation intent", () => {
  it("signal insert resolves venue only from portal token", () => {
    const sql = read("supabase/migrations/20261408500000_luv_ask_signals.sql");
    assert.match(sql, /_resolve_portal_ids\(p_token\)/);
    assert.doesNotMatch(sql, /p_venue_id/);
    const signals = read("lib/luv/ask-signals.ts");
    assert.match(signals, /record_luv_ask_signal/);
    assert.doesNotMatch(signals, /venueId:\s*input/);
  });
});

describe("AC-12 — Source integrity rules in prompt", () => {
  it("locks venue facts to Guide only", () => {
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm.",
      htcHits: retrieveCoupleHtcKnowledge("How do I make a payment?"),
      venueInfo: { policies: "Outside alcohol is not permitted." },
      portalContext: buildLuvAskPortalContext({ schedules: [] }),
    });
    assert.match(prompt, /Venue-specific facts/);
    assert.match(prompt, /ONLY VENUE KNOWLEDGE/);
    assert.match(prompt, /never authorize inventing a venue policy/i);
  });
});

describe("Parse fail-closed behavior", () => {
  it("invalid JSON becomes information_gap with next steps", () => {
    const parsed = parseLuvAskModelResponse("not json at all");
    assert.equal(parsed.outcome, "information_gap");
    assert.ok(parsed.nextSteps.length >= 1);
  });

  it("missing outcome with guideSection becomes answered_venue_guide", () => {
    const parsed = parseLuvAskModelResponse(
      JSON.stringify({
        answer: "Parking is free on Oak Street.",
        guideSection: "parking",
      }),
    );
    assert.equal(parsed.outcome, "answered_venue_guide");
    assert.equal(parsed.guideSection, "parking");
  });

  it("model cannot set outcome unavailable", () => {
    const parsed = parseLuvAskModelResponse(
      JSON.stringify({
        answer: "Nope",
        outcome: "unavailable",
        nextSteps: [],
      }),
    );
    assert.equal(parsed.outcome, "information_gap");
  });
});

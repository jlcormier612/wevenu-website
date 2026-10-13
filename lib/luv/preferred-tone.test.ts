import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  buildDashboardDraftPrompt,
  buildDashboardDraftSystemPrompt,
} from "@/lib/luv/dashboard-draft-prompt";
import { buildFollowUpPrompt } from "@/lib/luv/drafts";
import type { Lead } from "@/lib/leads/types";
import {
  LUV_TONE_INSTRUCTION,
  luvToneInstruction,
  normalizePreferredTone,
} from "@/lib/luv/settings";

function lead(): Lead {
  return {
    id: "lead-tone-1",
    venueId: "venue-1",
    salesStage: "new_inquiry",
    status: "new_inquiry",
    firstName: "Alex",
    lastName: "Tone",
    partnerFirstName: null,
    partnerLastName: null,
    email: "alex-tone@hellotocheers-test.invalid",
    phone: null,
    eventType: "wedding",
    eventDate: null,
    guestCount: 100,
    estimatedBudget: null,
    inquiryMessage: "We loved the garden.",
    inquiryDate: new Date().toISOString().slice(0, 10),
    lastContactedAt: null,
    nextActionText: null,
    followUpDate: null,
  } as Lead;
}

const panel = readFileSync(resolve("components/luv/luv-draft-panel.tsx"), "utf8");
const draftsSrc = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
const draftRouteSrc = readFileSync(resolve("app/api/luv/draft/route.ts"), "utf8");
const settingsSrc = readFileSync(resolve("lib/luv/settings.ts"), "utf8");
const settingsUi = readFileSync(resolve("components/settings/luv-settings-section.tsx"), "utf8");

describe("preferred tone — settings persistence contract", () => {
  it("exposes the three supported tone options in settings UI", () => {
    assert.match(settingsUi, /Warm & friendly/);
    assert.match(settingsUi, /Professional/);
    assert.match(settingsUi, /Formal/);
    assert.match(settingsUi, /value="warm"/);
    assert.match(settingsUi, /value="professional"/);
    assert.match(settingsUi, /value="formal"/);
  });

  it("persists preferred_tone through saveLuvSettings with normalization", () => {
    assert.match(settingsSrc, /preferred_tone: normalizePreferredTone\(settings\.preferredTone\)/);
    assert.match(settingsSrc, /preferredTone: normalizePreferredTone\(r\.preferred_tone\)/);
  });

  it("falls back safely for missing or invalid tone values", () => {
    assert.equal(normalizePreferredTone(undefined), "warm");
    assert.equal(normalizePreferredTone("not-a-tone"), "warm");
  });
});

describe("preferred tone — prompt path distinctions", () => {
  it("gives each tone a meaningfully different stylistic instruction", () => {
    const warm = LUV_TONE_INSTRUCTION.warm;
    const professional = LUV_TONE_INSTRUCTION.professional;
    const formal = LUV_TONE_INSTRUCTION.formal;
    assert.match(warm, /personable|approachable|conversational/i);
    assert.match(professional, /polished|courteous|confident|business-appropriate/i);
    assert.match(formal, /structured|precise|formal/i);
    assert.notEqual(warm, professional);
    assert.notEqual(professional, formal);
    assert.notEqual(warm, formal);
  });

  it("puts each saved tone into the lead follow-up prompt without a hardcoded warm override", () => {
    for (const tone of ["warm", "professional", "formal"] as const) {
      const prompt = buildFollowUpPrompt(lead(), "Meadowbrook", "Jen", tone, {
        proposalSent: false,
      });
      assert.match(prompt, /\*\*Tone \(required/);
      assert.ok(prompt.includes(luvToneInstruction(tone)));
      assert.doesNotMatch(prompt, /write a warm, personal follow-up/i);
      assert.doesNotMatch(prompt, /Prefer natural, warm,/);
      if (tone !== "warm") {
        assert.doesNotMatch(prompt, /warm & friendly style/i);
      }
    }
  });

  it("puts each saved tone into every dashboard draft prompt action", () => {
    for (const tone of ["warm", "professional", "formal"] as const) {
      for (const action of ["follow_up_messages", "seasonal_promo", "availability_plan", "other"]) {
        const prompt = buildDashboardDraftPrompt(action, { staleLeadCount: 2 }, "Meadowbrook", tone);
        assert.ok(prompt.includes(luvToneInstruction(tone)), `${action}/${tone}`);
        assert.doesNotMatch(prompt, /Write warm, professional content/i);
      }
      const system = buildDashboardDraftSystemPrompt("Meadowbrook", tone);
      assert.ok(system.includes(luvToneInstruction(tone)));
      assert.doesNotMatch(system, /Write warm, professional content/i);
    }
  });

  it("wires the draft API route through the shared tone-aware prompt builders", () => {
    assert.doesNotMatch(draftRouteSrc, /Write warm, professional content/);
    assert.match(draftRouteSrc, /buildDashboardDraftPrompt/);
    assert.match(draftRouteSrc, /buildDashboardDraftSystemPrompt/);
    assert.match(draftRouteSrc, /normalizePreferredTone\(settings\.preferredTone\)/);
  });
});

describe("preferred tone — draft persistence and UI honesty", () => {
  it("snapshots preferredTone into newly saved luv_drafts.context", () => {
    assert.match(draftsSrc, /preferredTone: normalizePreferredTone\(settings\.preferredTone\)/);
    // Settings changes must not rewrite existing drafts — no bulk update of luv_drafts content.
    assert.doesNotMatch(settingsSrc, /from\("luv_drafts"\)/);
  });

  it("uses tone-neutral panel copy instead of promising a fixed warm style", () => {
    assert.doesNotMatch(panel, /warm, personalized follow-up/i);
    assert.match(
      panel,
      /Luv will draft a personalized follow-up using your preferred writing tone and the/,
    );
    assert.match(panel, /available inquiry details\. You review, edit, and send it yourself\./);
  });

  it("keeps factual grounding and review-before-send invariants beside tone", () => {
    const prompt = buildFollowUpPrompt(lead(), "Meadowbrook", "Jen", "formal", {
      proposalSent: false,
    });
    assert.match(prompt, /Do not invent/);
    assert.match(prompt, /Never invent or allude to venue-internal notes/);
    assert.match(prompt, /Verified facts/);
    assert.match(draftsSrc, /status: "pending_review"/);
    assert.match(draftsSrc, /Luv never sends anything/);
  });
});

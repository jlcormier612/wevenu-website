import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const draftRoute = readFileSync(resolve("app/api/luv/draft/route.ts"), "utf8");
const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
const luvAsk = readFileSync(resolve("app/api/portal/luv-ask/route.ts"), "utf8");
const settingsUi = readFileSync(resolve("components/settings/luv-settings-section.tsx"), "utf8");

describe("/api/luv/draft launch-readiness", () => {
  it("gates Anthropic on draftingEnabled via existing settings", () => {
    assert.match(draftRoute, /getLuvSettings\(/);
    assert.match(draftRoute, /isLuvDraftingEnabled\(settings\)/);
    const gateIdx = draftRoute.indexOf("isLuvDraftingEnabled(settings)");
    const anthropicIdx = draftRoute.indexOf("client.messages.stream");
    assert.ok(gateIdx > 0 && anthropicIdx > gateIdx);
  });

  it("puts preferredTone into the system instruction", () => {
    assert.match(draftRoute, /luvToneInstruction\(settings\.preferredTone\)/);
  });

  it("returns a fixed friendly error instead of the SDK message", () => {
    assert.match(draftRoute, /error: "Failed to generate draft"/);
    assert.doesNotMatch(draftRoute, /error: message/);
  });

  it("keeps the existing 25s Anthropic timeout", () => {
    assert.match(draftRoute, /timeout:\s*25_000/);
  });
});

describe("lib/luv/drafts.ts launch-readiness", () => {
  it("gates generation on getLuvSettings draftingEnabled before Anthropic", () => {
    assert.match(drafts, /getLuvSettings\(/);
    assert.match(drafts, /isLuvDraftingEnabled\(settings\)/);
    const fnStart = drafts.indexOf("export async function generateFollowUpDraft");
    const gateIdx = drafts.indexOf("isLuvDraftingEnabled(settings)", fnStart);
    const callIdx = drafts.indexOf("await callClaude", fnStart);
    assert.ok(fnStart > 0 && gateIdx > fnStart && callIdx > gateIdx);
  });

  it("uses canonical preferredTone in the prompt", () => {
    assert.match(drafts, /luvToneInstruction\(tone\)/);
    assert.match(drafts, /settings\.preferredTone/);
  });

  it("times out hung Anthropic fetches", () => {
    assert.match(drafts, /AbortSignal\.timeout\(25_000\)/);
  });

  it("does not send messages autonomously", () => {
    assert.match(drafts, /Luv never sends anything/);
    assert.doesNotMatch(drafts, /sendEmail\(/);
    assert.doesNotMatch(drafts, /sendSms\(/);
    assert.doesNotMatch(drafts, /status: "sent"/);
  });
});

describe("/api/portal/luv-ask launch-readiness", () => {
  it("rejects oversized questions and rate-limits before Anthropic", () => {
    assert.match(luvAsk, /isLuvAskQuestionTooLong/);
    assert.match(luvAsk, /checkLuvAskRateLimit/);
    const postIdx = luvAsk.indexOf("export async function POST");
    const lengthIdx = luvAsk.indexOf("isLuvAskQuestionTooLong", postIdx);
    const rateIdx = luvAsk.indexOf("checkLuvAskRateLimit", postIdx);
    const fetchIdx = luvAsk.indexOf('fetch("https://api.anthropic.com/v1/messages"');
    assert.ok(postIdx > 0 && lengthIdx > postIdx && rateIdx > lengthIdx && fetchIdx > rateIdx);
  });

  it("gates Anthropic on the same draftingEnabled setting", () => {
    assert.match(luvAsk, /getLuvSettingsForVenueId/);
    assert.match(luvAsk, /isLuvDraftingEnabled\(settings\)/);
    const gateIdx = luvAsk.indexOf("isLuvDraftingEnabled(settings)");
    const fetchIdx = luvAsk.indexOf('fetch("https://api.anthropic.com/v1/messages"');
    assert.ok(gateIdx > 0 && fetchIdx > gateIdx);
  });

  it("applies preferredTone conservatively and keeps grounding rules", () => {
    assert.match(luvAsk, /luvAskVoiceInstruction\(settings\.preferredTone\)/);
    assert.match(luvAsk, /Only use the information provided below/);
    assert.match(luvAsk, /Never make up information about the venue/);
  });

  it("times out hung Anthropic fetches and uses a friendly catch", () => {
    assert.match(luvAsk, /AbortSignal\.timeout\(25_000\)/);
    assert.match(luvAsk, /Luv couldn't connect right now/);
  });
});

describe("Luv settings UI honesty", () => {
  it("does not offer an interactive autonomyLevel selector", () => {
    assert.doesNotMatch(settingsUi, /value="suggest_only"/);
    assert.doesNotMatch(settingsUi, /value="draft_for_review"/);
    assert.doesNotMatch(settingsUi, /Autonomy level/);
    assert.match(settingsUi, /Luv never sends messages on its own/);
  });
});

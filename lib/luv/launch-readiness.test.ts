import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const draftRoute = readFileSync(resolve("app/api/luv/draft/route.ts"), "utf8");
const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
const luvAsk = readFileSync(resolve("app/api/portal/luv-ask/route.ts"), "utf8");
const settingsUi = readFileSync(resolve("components/settings/luv-settings-section.tsx"), "utf8");
const openaiHelper = readFileSync(resolve("lib/ai/openai.ts"), "utf8");

describe("/api/luv/draft launch-readiness", () => {
  it("gates OpenAI on draftingEnabled via existing settings", () => {
    assert.match(draftRoute, /getLuvSettings\(/);
    assert.match(draftRoute, /isLuvDraftingEnabled\(settings\)/);
    const gateIdx = draftRoute.indexOf("isLuvDraftingEnabled(settings)");
    const openAiIdx = draftRoute.indexOf("await openAiChatCompletion", gateIdx);
    assert.ok(gateIdx > 0 && openAiIdx > gateIdx);
  });

  it("puts preferredTone into the system instruction", () => {
    assert.match(draftRoute, /luvToneInstruction\(settings\.preferredTone\)/);
  });

  it("returns a fixed friendly error instead of the SDK message", () => {
    assert.match(draftRoute, /error: "Failed to generate draft"/);
    assert.doesNotMatch(draftRoute, /error: message/);
  });

  it("uses honest errors when drafting is off vs unavailable", () => {
    assert.match(draftRoute, /Luv drafting is turned off in Settings/);
    assert.match(draftRoute, /AI drafting is temporarily unavailable/);
  });

  it("uses non-streaming OpenAI fetch so auth failures return JSON", () => {
    assert.match(draftRoute, /openAiChatCompletion/);
    assert.match(draftRoute, /OPENAI_MODEL_FAST/);
    assert.doesNotMatch(draftRoute, /messages\.stream/);
    assert.doesNotMatch(draftRoute, /toReadableStream/);
    assert.doesNotMatch(draftRoute, /api\.anthropic\.com/);
  });

  it("keeps the existing 25s OpenAI timeout", () => {
    assert.match(draftRoute, /timeoutMs: 25_000/);
  });
});

describe("lib/luv/drafts.ts launch-readiness", () => {
  it("gates generation on getLuvSettings draftingEnabled before OpenAI", () => {
    assert.match(drafts, /getLuvSettings\(/);
    assert.match(drafts, /isLuvDraftingEnabled\(settings\)/);
    const fnStart = drafts.indexOf("export async function generateFollowUpDraft");
    const gateIdx = drafts.indexOf("isLuvDraftingEnabled(settings)", fnStart);
    const callIdx = drafts.indexOf("await generateDraftText", fnStart);
    assert.ok(fnStart > 0 && gateIdx > fnStart && callIdx > gateIdx);
  });

  it("uses canonical preferredTone in the prompt", () => {
    assert.match(drafts, /luvToneInstruction\(tone\)/);
    assert.match(drafts, /settings\.preferredTone/);
  });

  it("times out hung OpenAI fetches", () => {
    assert.match(drafts, /timeoutMs: 25_000/);
  });

  it("does not send messages autonomously", () => {
    assert.match(drafts, /Luv never sends anything/);
    assert.doesNotMatch(drafts, /sendEmail\(/);
    assert.doesNotMatch(drafts, /sendSms\(/);
    assert.doesNotMatch(drafts, /status: "sent"/);
  });

  it("returns a friendly failure instead of raw OpenAI errors", () => {
    assert.match(drafts, /Luv couldn't generate a draft right now\. Please try again\./);
    assert.doesNotMatch(
      drafts.slice(drafts.indexOf("export async function generateFollowUpDraft")),
      /return \{ ok: false, message \}/,
    );
  });
});

describe("/api/portal/luv-ask launch-readiness", () => {
  it("rejects oversized questions and rate-limits before OpenAI", () => {
    assert.match(luvAsk, /isLuvAskQuestionTooLong/);
    assert.match(luvAsk, /checkLuvAskRateLimit/);
    const postIdx = luvAsk.indexOf("export async function POST");
    const lengthIdx = luvAsk.indexOf("isLuvAskQuestionTooLong", postIdx);
    const rateIdx = luvAsk.indexOf("checkLuvAskRateLimit", postIdx);
    const fetchIdx = luvAsk.indexOf("await openAiChatCompletion", rateIdx);
    assert.ok(postIdx > 0 && lengthIdx > postIdx && rateIdx > lengthIdx && fetchIdx > rateIdx);
  });

  it("gates OpenAI on the same draftingEnabled setting", () => {
    assert.match(luvAsk, /getLuvSettingsForVenueId/);
    assert.match(luvAsk, /isLuvDraftingEnabled\(settings\)/);
    const gateIdx = luvAsk.indexOf("isLuvDraftingEnabled(settings)");
    const fetchIdx = luvAsk.indexOf("await openAiChatCompletion", gateIdx);
    assert.ok(gateIdx > 0 && fetchIdx > gateIdx);
  });

  it("applies preferredTone conservatively and keeps grounding rules", () => {
    assert.match(luvAsk, /luvAskVoiceInstruction\(settings\.preferredTone\)/);
    assert.match(luvAsk, /buildCoupleAskLuvSystemPrompt/);
    assert.match(luvAsk, /retrieveCoupleHtcKnowledge/);
    const prompt = readFileSync(resolve("lib/luv/couple-ask-prompt.ts"), "utf8");
    assert.match(prompt, /Only use the information in the knowledge layers below/);
    assert.match(prompt, /Never make up venue policies/);
    assert.match(prompt, /HTC PRODUCT KNOWLEDGE/);
    assert.match(prompt, /VENUE KNOWLEDGE/);
    assert.match(prompt, /CURRENT PORTAL CONTEXT/);
    assert.match(prompt, /Never say "Typically, couples/);
  });

  it("times out hung OpenAI fetches and uses a friendly catch", () => {
    assert.match(luvAsk, /timeoutMs: 25_000/);
    assert.match(luvAsk, /Luv couldn't connect right now/);
  });
});

describe("shared OpenAI helper launch-readiness", () => {
  it("uses Chat Completions directly with Bearer auth and no tools/streaming", () => {
    assert.match(openaiHelper, /api\.openai\.com\/v1\/chat\/completions/);
    assert.match(openaiHelper, /Authorization: `Bearer \$\{apiKey\}`/);
    assert.match(openaiHelper, /max_completion_tokens/);
    assert.match(openaiHelper, /reasoning_effort/);
    assert.doesNotMatch(openaiHelper, /tools:/);
    assert.doesNotMatch(openaiHelper, /stream:\s*true/);
    assert.doesNotMatch(openaiHelper, /ANTHROPIC/);
  });
});

describe("Luv settings UI honesty", () => {
  it("does not offer an interactive autonomyLevel selector", () => {
    assert.doesNotMatch(settingsUi, /value="suggest_only"/);
    assert.doesNotMatch(settingsUi, /value="draft_for_review"/);
    assert.doesNotMatch(settingsUi, /Autonomy level/);
    assert.match(settingsUi, /Luv never sends messages on its own/);
    assert.match(settingsUi, /quiet dashboard note/);
  });
});

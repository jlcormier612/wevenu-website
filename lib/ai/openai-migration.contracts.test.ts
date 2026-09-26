import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, it, mock } from "node:test";

import { proposeStructuredRows, proposeFieldMapping } from "@/lib/luv/import-assist";
import { proposePlaybookDraft } from "@/lib/luv/playbook-import";
import { proposeTimelineDraft } from "@/lib/luv/timeline-import";
import { proposeMessageTemplate } from "@/lib/luv/message-template-import";
import { extractInquiryFromEmail } from "@/lib/lead-intake/email-extract";
import { proposeActiveCommitmentFromDocument } from "@/lib/migration/smart-extract";
import { OPENAI_CHAT_COMPLETIONS_URL, OPENAI_MODEL_DEFAULT } from "@/lib/ai/openai";

const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  mock.restoreAll();
});

function mockOpenAiContent(content: string) {
  process.env.OPENAI_API_KEY = "sk-test";
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), OPENAI_CHAT_COMPLETIONS_URL);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, OPENAI_MODEL_DEFAULT);
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer sk-test");
    return new Response(JSON.stringify({
      choices: [{ message: { content } }],
    }), { status: 200 });
  });
}

describe("Luv draft Subject:/body parsing (source contract)", () => {
  it("keeps Subject: parser and pending_review in lead drafts", () => {
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.match(drafts, /function parseEmailDraft/);
    assert.match(drafts, /startsWith\("subject:"\)/);
    assert.match(drafts, /status: "pending_review"/);
    assert.doesNotMatch(drafts, /sendEmail\(/);
    assert.doesNotMatch(drafts, /sendSms\(/);
  });
});

describe("Ask Luv / roll-up / concierge JSON contracts (source)", () => {
  it("Ask Luv still expects answer + guideSection JSON", () => {
    const luvAsk = readFileSync(resolve("app/api/portal/luv-ask/route.ts"), "utf8");
    assert.match(luvAsk, /function parseAskJson/);
    assert.match(luvAsk, /guideSection/);
    assert.match(luvAsk, /buildCoupleAskLuvSystemPrompt/);
    const prompt = readFileSync(resolve("lib/luv/couple-ask-prompt.ts"), "utf8");
    assert.match(prompt, /Only use the information in the knowledge layers below/);
    assert.match(prompt, /HTC PRODUCT KNOWLEDGE/);
    assert.match(prompt, /VENUE KNOWLEDGE/);
  });

  it("roll-up still requires the four observation keys", () => {
    const roll = readFileSync(resolve("lib/luv/roll-up-service.ts"), "utf8");
    assert.match(roll, /whatIsWorking/);
    assert.match(roll, /needsAttention/);
    assert.match(roll, /opportunities/);
    assert.match(roll, /customerLove/);
  });
});

describe("import-assist JSON with mocked OpenAI", () => {
  it("parses a structured rows array and rejects hallucinated headers on mapping", async () => {
    mockOpenAiContent(JSON.stringify([
      { businessName: "Acme Floral", email: "a@example.com" },
    ]));
    const rows = await proposeStructuredRows("Acme Floral a@example.com", "vendors");
    assert.equal(rows.ok, true);
    if (rows.ok) {
      assert.equal(rows.aiStructured, true);
      assert.equal(rows.rows[0]?.businessName, "Acme Floral");
    }

    mock.restoreAll();
    mockOpenAiContent(JSON.stringify({
      businessName: "Company Name",
      email: "Not A Real Header",
    }));
    const mapping = await proposeFieldMapping(["Company Name", "Email"], "vendors");
    assert.equal(mapping.ok, true);
    if (mapping.ok) {
      assert.equal(mapping.mapping.businessName, "Company Name");
      assert.equal(mapping.mapping.email ?? null, null);
    }
  });

  it("falls back without OpenAI configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const rows = await proposeStructuredRows("Alpha\nBeta", "vendors");
    assert.equal(rows.ok, true);
    if (rows.ok) assert.equal(rows.aiStructured, false);
  });
});

describe("playbook / timeline / message-template imports with mocked OpenAI", () => {
  it("parses playbook milestones JSON", async () => {
    mockOpenAiContent(JSON.stringify({
      milestones: [{ name: "6 months out", tasks: [{ title: "Book florist", instructions: "", daysOffset: -180, guessed: false }] }],
    }));
    const result = await proposePlaybookDraft("- Book florist", "client");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.aiStructured, true);
      assert.equal(result.milestones[0]?.tasks[0]?.title, "Book florist");
    }
  });

  it("parses timeline items JSON", async () => {
    mockOpenAiContent(JSON.stringify({
      items: [{ title: "Ceremony", description: "", timeOfDay: "16:00", minutesOffset: null, guessed: false }],
    }));
    const result = await proposeTimelineDraft("4pm Ceremony");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.items[0]?.timeOfDay, "16:00");
  });

  it("parses message template JSON", async () => {
    mockOpenAiContent(JSON.stringify({
      name: "Tour Follow-up",
      emailSubject: "Great meeting you",
      emailBody: "Thanks for touring!",
      smsBody: "",
    }));
    const result = await proposeMessageTemplate("Thanks for touring!", "email", "inquiry_follow_up");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.name, "Tour Follow-up");
      assert.equal(result.emailSubject, "Great meeting you");
    }
  });
});

describe("Email Intake + Smart Import extraction with mocked OpenAI", () => {
  it("parses email inquiry JSON", async () => {
    mockOpenAiContent(JSON.stringify({
      firstName: "Ada",
      lastName: "Lovelace",
      partnerFirstName: null,
      partnerLastName: null,
      email: "ada@example.com",
      phone: null,
      eventType: "wedding",
      eventDate: "2027-06-01",
      guestCount: 120,
      inquiryMessage: "Looking for a June date",
      confidence: 90,
    }));
    const result = await extractInquiryFromEmail("New inquiry", "Hi, I'm Ada Lovelace...");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.input.firstName, "Ada");
      assert.equal(result.input.confidenceScore, 90);
    }
  });

  it("parses smart-import commitment JSON", async () => {
    mockOpenAiContent(JSON.stringify({
      clientEmail: "couple@example.com",
      eventDate: "2027-09-12",
      contractedTotal: "12000",
      packageName: "All-inclusive",
      lines: [{ description: "Package", quantity: "1", unitPrice: "12000" }],
      scheduleLines: [
        { label: "Deposit", amount: "3000", dueDate: "2026-01-01", obligationKind: "deposit", alreadyPaid: true },
        { label: "Balance", amount: "9000", dueDate: "2027-08-01", obligationKind: "balance", alreadyPaid: false },
      ],
      contractTitle: "Smith Wedding Contract",
      contractSignedAt: "2026-01-01",
      contractSignerName: "Alex Smith",
      bookedAt: "2026-01-01",
      confidenceNotes: ["dates clear"],
    }));
    const result = await proposeActiveCommitmentFromDocument(
      "Contract for Smith Wedding on 2027-09-12. Total $12000. Deposit $3000. Email couple@example.com",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.proposal.clientEmail, "couple@example.com");
      assert.equal(result.proposal.contractedTotal, "12000");
    }
  });
});

describe("RSVP Concierge OpenAI wiring (source)", () => {
  it("uses shared OpenAI helper after token validation", () => {
    const concierge = readFileSync(resolve("app/api/rsvp/concierge/route.ts"), "utf8");
    const invalidIdx = concierge.indexOf('error: "invalid_token"');
    const openAiIdx = concierge.indexOf("isOpenAiConfigured()", invalidIdx);
    const callIdx = concierge.indexOf("await openAiChatCompletion", openAiIdx);
    assert.ok(invalidIdx > 0 && openAiIdx > invalidIdx && callIdx > openAiIdx);
    assert.doesNotMatch(concierge, /api\.anthropic\.com/);
    assert.doesNotMatch(concierge, /ANTHROPIC_API_KEY/);
  });
});

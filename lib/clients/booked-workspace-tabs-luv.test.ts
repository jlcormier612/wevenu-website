/**
 * Booked client workspace — two-row tab nav + first-class Luv tab.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const eventDetail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const clientsPage = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
const luvActions = readFileSync(resolve("app/(app)/leads/[id]/luv-actions.ts"), "utf8");
const panel = readFileSync(resolve("components/luv/contextual-observations-panel.tsx"), "utf8");

function rowBlock(src: string, testId: string): string {
  const marker = `data-testid="${testId}"`;
  const start = src.indexOf(marker);
  assert.ok(start > 0, `missing ${testId}`);
  const end = src.indexOf("</TabsList>", start);
  assert.ok(end > start, `unclosed TabsList for ${testId}`);
  return src.slice(start, end);
}

function triggerValues(row: string): string[] {
  return [...row.matchAll(/TabsTrigger value="([^"]+)"/g)].map((m) => m[1]);
}

describe("Booked workspace two-row nav + Luv tab", () => {
  it("renders two deliberate rows of seven with the required order", () => {
    const row1 = triggerValues(rowBlock(eventDetail, "booked-tab-row-1"));
    const row2 = triggerValues(rowBlock(eventDetail, "booked-tab-row-2"));
    assert.deepEqual(row1, [
      "overview",
      "playbook",
      "timeline",
      "floorplan",
      "vendors",
      "inventory",
      "event-order",
    ]);
    assert.deepEqual(row2, [
      "questionnaires",
      "documents",
      "invoice",
      "messages",
      "activity",
      "notes",
      "luv",
    ]);
    assert.equal(row1.length, 7);
    assert.equal(row2.length, 7);
    assert.equal(row2[6], "luv");
  });

  it("uses grid cols-7 per row (not flex-wrap accidental wrapping)", () => {
    const row1 = rowBlock(eventDetail, "booked-tab-row-1");
    const row2 = rowBlock(eventDetail, "booked-tab-row-2");
    assert.match(row1, /grid-cols-7/);
    assert.match(row2, /grid-cols-7/);
    const nav = eventDetail.slice(
      eventDetail.indexOf('data-testid="booked-workspace-tab-nav"'),
      eventDetail.indexOf('TabsContent value="overview"'),
    );
    assert.doesNotMatch(nav, /TabsList className="flex-wrap"/);
  });

  it("booked Luv tab is always present and hosts LuvDraftPanel with originating lead", () => {
    assert.match(eventDetail, /TabsTrigger value="luv"/);
    assert.match(eventDetail, /TabsContent value="luv"/);
    assert.match(eventDetail, /LuvDraftPanel/);
    assert.match(eventDetail, /lead=\{luvLead\}/);
    assert.match(clientsPage, /getDraftsForLead/);
    assert.match(clientsPage, /loadLeadFollowUpPresentation/);
    assert.match(clientsPage, /luvLead=\{luvLeadBundle\.luvLead\}/);
  });

  it("Luv tab stays available when observations are empty (emptyHint on tab, Overview still hard-vanishes)", () => {
    const luvTab = eventDetail.slice(
      eventDetail.indexOf('TabsContent value="luv"'),
      eventDetail.indexOf("Feedback — post-wedding"),
    );
    assert.match(
      luvTab,
      /emptyHint="There's nothing Luv needs to flag for this booking right now\."/,
    );
    assert.match(luvTab, /LuvDraftPanel/);
    assert.match(panel, /if \(!emptyHint\) return null/);
  });

  it("draft bridge uses booked Conversation without auto-send", () => {
    assert.match(eventDetail, /handleUseLuvDraft/);
    assert.match(eventDetail, /onUseDraft=\{handleUseLuvDraft\}/);
    assert.match(eventDetail, /initialBody=\{messagePrefill\?\.body\}/);
    assert.match(eventDetail, /draftStatusAfterSuccessfulSend/);
    assert.match(
      eventDetail,
      /onAuthoritativeSendSuccess=\{handleAuthoritativeConversationSendSuccess\}/,
    );
    assert.match(luvActions, /generateFollowUpDraft\(lead\)/);
    assert.match(luvActions, /revalidatePath\(`\/clients\/\$\{/);
  });

  it("customer-facing drafts still exclude venue-originated inquiry notes at the prompt boundary", () => {
    assert.match(drafts, /customerFacingInquiryContext|customerFacingInquiryMessage/);
    assert.match(drafts, /Never invent or allude to venue-internal notes/);
  });

  it("lead Luv tab remains intact", () => {
    assert.match(leadDetail, /TabsTrigger value="luv"/);
    assert.match(leadDetail, /LuvDraftPanel/);
    assert.match(leadDetail, /TabsContent value="luv"/);
  });
});

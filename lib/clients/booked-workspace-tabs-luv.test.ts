/**
 * Booked client workspace — two-row tab nav + first-class Luv tab.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const eventDetail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
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
  it("renders two deliberate P2-A tab rows with Luv on row 2", () => {
    const row1 = triggerValues(rowBlock(eventDetail, "booked-tab-row-1"));
    const row2 = triggerValues(rowBlock(eventDetail, "booked-tab-row-2"));
    // P2-A: Questionnaires / Inventory / Event Order moved off tab rows to
    // Overview workspace cards + hash-addressable TabsContent.
    assert.deepEqual(row1, [
      "overview",
      "playbook",
      "timeline",
      "floorplan",
      "vendors",
    ]);
    assert.deepEqual(row2, [
      "documents",
      "invoice",
      "messages",
      "activity",
      "notes",
      "luv",
    ]);
    assert.equal(row1.length, 5);
    assert.equal(row2.length, 6);
    assert.equal(row2[5], "luv");
    assert.match(eventDetail, /TabsContent value="questionnaires"/);
    assert.match(eventDetail, /data-testid="open-questionnaires-card"/);
  });

  it("uses fixed grid cols per row (not flex-wrap accidental wrapping)", () => {
    const row1 = rowBlock(eventDetail, "booked-tab-row-1");
    const row2 = rowBlock(eventDetail, "booked-tab-row-2");
    assert.match(row1, /grid-cols-5/);
    assert.match(row2, /grid-cols-6/);
    const nav = eventDetail.slice(
      eventDetail.indexOf('data-testid="booked-workspace-tab-nav"'),
      eventDetail.indexOf('TabsContent value="overview"'),
    );
    assert.doesNotMatch(nav, /TabsList className="flex-wrap"/);
  });

  it("booked Luv tab hosts LuvDraftPanel with originating lead when Luv is enabled", () => {
    assert.match(eventDetail, /TabsTrigger value="luv"/);
    assert.match(eventDetail, /TabsContent value="luv"/);
    assert.match(eventDetail, /LuvDraftPanel/);
    assert.match(eventDetail, /lead=\{luvLead\}/);
    assert.match(eventDetail, /luvEnabled/);
    // Booked detail (Wave 7A island) owns the Luv draft pack load.
    const bookedDetail = readFileSync(
      resolve("app/(app)/clients/[id]/booked-workspace-detail.tsx"),
      "utf8",
    );
    assert.match(bookedDetail, /getDraftsForLead/);
    assert.match(bookedDetail, /loadLeadFollowUpPresentation/);
    assert.match(bookedDetail, /luvLead=\{luvLeadBundle\.luvLead\}/);
    assert.match(bookedDetail, /luvEnabled=\{luvEnabled\}/);
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
    // TabsTrigger props may wrap across lines; require value="luv" on the trigger.
    assert.match(leadDetail, /<TabsTrigger[\s\S]*?value="luv"/);
    assert.match(leadDetail, /LuvDraftPanel/);
    assert.match(leadDetail, /TabsContent value="luv"/);
  });
});

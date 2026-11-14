/**
 * Open Questionnaires / Event Order / event items must activate, wait,
 * scroll the workspace main (not scrollIntoView), and focus the section.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const scroll = readFileSync(resolve("lib/conversations/page-flow-scroll.ts"), "utf8");

describe("Open workspace section scrolling", () => {
  it("Open cards share one helper that activates then scrolls after mount", () => {
    const helper = detail.slice(
      detail.indexOf("function openWorkspaceSection"),
      detail.indexOf("function openWorkspaceSection") + 520,
    );
    assert.match(helper, /setActiveTab\(tab\)/);
    assert.match(helper, /scrollWorkspaceMainToId\(tab\)/);
    assert.match(detail, /openWorkspaceSection\("questionnaires"\)/);
    assert.match(detail, /openWorkspaceSection\("event-order"\)/);
    assert.match(detail, /openWorkspaceSection\("inventory"\)/);
  });

  it("section targets exist with focusable ids matching the Open hashes", () => {
    assert.match(detail, /id="questionnaires"/);
    assert.match(detail, /id="event-order"/);
    assert.match(detail, /id="inventory"/);
    assert.match(detail, /tabIndex=\{-1\}/);
  });

  it("scroll helper waits for mount, uses workspace main, and focuses", () => {
    assert.match(scroll, /export async function scrollWorkspaceMainToId/);
    assert.match(scroll, /waitForElementById/);
    assert.match(scroll, /scrollWorkspaceMainToElement/);
    assert.match(scroll, /target\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
    const helper = detail.slice(
      detail.indexOf("function openWorkspaceSection"),
      detail.indexOf("const [setupPaymentsOpen"),
    );
    assert.doesNotMatch(helper, /scrollIntoView/);
  });

  it("does not change Returning Customers Start New Inquiry or Event Order workflow", () => {
    assert.doesNotMatch(detail, /start-new-inquiry|Start New Inquiry/);
    assert.match(detail, /EventCommercialWorkflow/);
    assert.match(detail, /EventInventoryPanel/);
    assert.match(detail, /QuestionnaireFamilyPanel/);
  });
});

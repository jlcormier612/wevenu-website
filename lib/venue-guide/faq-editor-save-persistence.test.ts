/**
 * Venue Guide FAQ Save persistence — Client FAQ editor must round-trip through
 * saveGuideAction → venue_operational_info.faqs without hanging the UI when the
 * Server Action throws (e.g. stale deployment action id).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { GuideFaqEntry } from "@/lib/venue-guide/audience";
import { isFaqPublished, resolveFaqsForAudience } from "@/lib/venue-guide/audience";

const GUIDE_EDITOR = readFileSync(resolve("components/guide/venue-guide-editor.tsx"), "utf8");
const GUIDE_ACTIONS = readFileSync(resolve("app/(app)/guide/actions.ts"), "utf8");

describe("Venue Guide FAQ save error handling wiring", () => {
  it("save() catches Server Action failures and always clears saving state", () => {
    assert.match(GUIDE_EDITOR, /async function save\(/);
    assert.match(GUIDE_EDITOR, /try \{/);
    assert.match(GUIDE_EDITOR, /saveGuideAction\(partial\)/);
    assert.match(GUIDE_EDITOR, /catch \(err\)/);
    assert.match(GUIDE_EDITOR, /finally \{/);
    assert.match(GUIDE_EDITOR, /setSaving\(null\)/);
    assert.match(GUIDE_EDITOR, /Failed to find Server Action|out of date after an update/i);
  });

  it("client FAQ save commits parent state only after persistence succeeds", () => {
    // Prevents phantom "saved" UI when the action throws or returns ok:false.
    const clientSave = GUIDE_EDITOR.match(
      /onSaveClient=\{async items => \{[\s\S]*?\}\}/,
    )?.[0] ?? "";
    assert.match(clientSave, /const ok = await save\(\{ faqs: items \}, "faqs"\)/);
    assert.match(clientSave, /if \(ok\) setData/);
    assert.doesNotMatch(clientSave, /setData\([\s\S]*await save\(\{ faqs/);
  });

  it("saveGuideAction upserts venue_operational_info.faqs and never throws", () => {
    assert.match(GUIDE_ACTIONS, /export async function saveGuideAction/);
    assert.match(GUIDE_ACTIONS, /venue_operational_info/);
    assert.match(GUIDE_ACTIONS, /onConflict:\s*"venue_id"/);
    assert.match(GUIDE_ACTIONS, /try \{/);
    assert.match(GUIDE_ACTIONS, /catch \(err\)/);
    assert.match(GUIDE_ACTIONS, /updated_at/);
  });

  it("does not invent a second FAQ storage path", () => {
    assert.match(GUIDE_EDITOR, /saveGuideAction/);
    assert.doesNotMatch(GUIDE_EDITOR, /saveFaqAction|faqStorage2|venue_faqs_table/i);
    assert.match(GUIDE_ACTIONS, /\.upsert\([\s\S]*\.\.\.partial/);
  });
});

describe("FAQ publication semantics preserved by persistence path", () => {
  it("custom client FAQ with published:true appears for clients/brochures", () => {
    const faqs: GuideFaqEntry[] = [
      { question: "Sparklers?", answer: "With approval.", published: true },
      { question: "Draft?", answer: "Hidden.", published: false },
    ];
    const clients = resolveFaqsForAudience(faqs, "clients");
    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.question, "Sparklers?");
    assert.equal(isFaqPublished(faqs[0]!), true);
    assert.equal(isFaqPublished(faqs[1]!), false);
  });

  it("vendor-only overrides never leak into client brochure projection", () => {
    const faqs: GuideFaqEntry[] = [
      { question: "Client Q", answer: "Client A", published: true },
    ];
    const clients = resolveFaqsForAudience(faqs, "clients", {
      faqs: { vendors: [{ question: "Load-in?", answer: "Dock B" }] },
    });
    assert.deepEqual(clients, [{ question: "Client Q", answer: "Client A" }]);
  });
});

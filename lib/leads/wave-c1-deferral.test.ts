import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Wave C1 lead workspace deferral prototype", () => {
  it("omits documents and Luv draft fetches from the Overview critical-path Promise.all", () => {
    const page = readFileSync("app/(app)/leads/[id]/page.tsx", "utf8");
    // Critical-path wave must not list these four calls.
    const critical = page.slice(
      page.indexOf("const [lead, holds, spaces, capacityRules, tourAppointments"),
      page.indexOf("if (!lead) return null"),
    );
    assert.match(critical, /getTourAppointmentsForLead/);
    assert.match(critical, /getPackagesWithItems/);
    assert.doesNotMatch(critical, /getDocuments\(/);
    assert.doesNotMatch(critical, /getVenueWorkspaceDocuments/);
    assert.doesNotMatch(critical, /getPinnedDocumentKeys/);
    assert.doesNotMatch(critical, /getDraftsForLead/);

    // Eager only when deep-linked via searchParams.
    assert.match(page, /eagerDocuments = tabParam === "documents"/);
    assert.match(page, /eagerLuvDrafts = Boolean\(autoLuvDraft\)/);
    assert.match(page, /deferDocuments=\{page\.documentsDeferred\}/);
    assert.match(page, /deferLuvDrafts=\{page\.luvDraftsDeferred\}/);
  });

  it("loads deferred packs via authorized server actions on tab activation", () => {
    const actions = readFileSync("app/(app)/leads/[id]/deferred-tab-actions.ts", "utf8");
    assert.match(actions, /"use server"/);
    assert.match(actions, /loadLeadDocumentsPackAction/);
    assert.match(actions, /loadLeadLuvDraftsPackAction/);
    assert.match(actions, /getLead\(leadId\)/);

    const detail = readFileSync("components/leads/lead-detail.tsx", "utf8");
    assert.match(detail, /loadLeadDocumentsPackAction/);
    assert.match(detail, /loadLeadLuvDraftsPackAction/);
    assert.match(detail, /lead-documents-deferred-pending/);
    assert.match(detail, /lead-luv-deferred-pending/);
    assert.match(detail, /docLoadGen/);
    assert.match(detail, /luvLoadGen/);
  });
});

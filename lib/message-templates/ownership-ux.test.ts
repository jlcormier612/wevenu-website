/**
 * Messages starter ownership / Customize UX — aligns with Template Management model.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Message template ownership UX", () => {
  const list = readFileSync(resolve("components/communication/message-template-list.tsx"), "utf8");
  const repo = readFileSync(resolve("lib/message-templates/repository.ts"), "utf8");
  const service = readFileSync(resolve("lib/message-templates/service.ts"), "utf8");
  const editPage = readFileSync(
    resolve("app/(app)/communication/templates/[id]/edit/page.tsx"),
    "utf8",
  );
  const gate = readFileSync(resolve("components/communication/message-starter-edit-gate.tsx"), "utf8");
  const page = readFileSync(resolve("app/(app)/communication/templates/page.tsx"), "utf8");
  const actions = readFileSync(resolve("app/(app)/communication/templates/actions.ts"), "utf8");

  it("list promotes Customize as primary action for HTC starters", () => {
    assert.match(list, /LIBRARY_LABELS\.customize/);
    assert.match(list, /isStarter/);
    assert.match(list, /handleCustomize/);
    assert.match(list, /duplicateTemplateAction/);
    assert.match(list, /id: "customize"/);
    // Starter primary actions are Customize-driven; Edit is only for !isStarter.
    assert.match(list, /isStarter\s*\n\s*\? \[[\s\S]*?id: "customize"[\s\S]*?\]\s*:\s*\[[\s\S]*?id: "edit"/);
  });

  it("Customize wires to duplicateTemplateAction (independent venue-owned copy)", () => {
    assert.match(list, /handleCustomize[\s\S]*duplicateTemplateAction/);
    assert.match(gate, /duplicateTemplateAction/);
    const dup = repo.slice(repo.indexOf("export async function duplicateTemplate"));
    const body = dup.slice(0, 900);
    assert.match(body, /insertTemplate\(client, venueId/);
    assert.doesNotMatch(body, /sourceMasterKey/);
    assert.match(body, /copyTemplateAttachments/);
  });

  it("server rejects in-place content updates to starter rows", () => {
    const updateRepo = repo.slice(repo.indexOf("export async function updateTemplate"));
    const repoBody = updateRepo.slice(0, updateRepo.indexOf("export async function deleteTemplate"));
    assert.match(repoBody, /STARTER_PROTECTED/);
    assert.match(repoBody, /sourceMasterKey/);

    const updateSvc = service.slice(service.indexOf("export async function updateTemplate_"));
    const svcBody = updateSvc.slice(0, updateSvc.indexOf("export async function deleteTemplate_"));
    assert.match(svcBody, /existing\.sourceMasterKey/);
    assert.match(svcBody, /Customize this Hello to Cheers starter/);
  });

  it("edit page gates starters behind Customize banner (no TemplateForm)", () => {
    assert.match(editPage, /MessageStarterEditGate/);
    assert.match(editPage, /sourceMasterKey/);
    const starterBranch = editPage.slice(
      editPage.indexOf("if (isStarter)"),
      editPage.indexOf("const [attachments"),
    );
    assert.match(starterBranch, /MessageStarterEditGate/);
    assert.doesNotMatch(starterBranch, /TemplateForm/);
    assert.match(gate, /StarterOwnershipBanner/);
  });

  it("venue-owned templates keep Edit and Duplicate", () => {
    assert.match(list, /LIBRARY_LABELS\.edit/);
    assert.match(list, /LIBRARY_LABELS\.duplicate/);
    assert.match(list, /handleDuplicate/);
    // Duplicate only in non-starter overflow.
    assert.match(list, /\.\.\.\(!isStarter[\s\S]*LIBRARY_LABELS\.duplicate/);
  });

  it("automation-linked deletion remains blocked", () => {
    const del = repo.slice(repo.indexOf("export async function deleteTemplate"));
    assert.match(del, /sequence_steps/);
    assert.match(del, /Automation step/);
    assert.match(del, /on delete restrict|template_id/);
  });

  it("Add another copy / starter re-provision remains separate", () => {
    assert.match(actions, /addStarterMessageAgainAction/);
    assert.match(page, /MessageTemplateStarterPicker|AddHelloToCheersStarters/);
    assert.doesNotMatch(list, /addStarterMessageAgainAction/);
  });

  it("product copy no longer tells users to edit HTC starters in place", () => {
    assert.match(page, /Customize into your venue/);
    assert.doesNotMatch(page, /starters you can edit to sound like your venue/);
    assert.match(list, /Customize a Hello to Cheers starter/);
  });

  it("venue ownership checks remain on mutate paths", () => {
    assert.match(repo, /\.eq\("venue_id", venueId\)/);
    const dup = repo.slice(repo.indexOf("export async function duplicateTemplate"));
    assert.match(dup, /getTemplate\(client, venueId, sourceId\)/);
  });
});

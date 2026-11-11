/**
 * Contracts starter ownership / Customize UX — aligns with Template Management model.
 * Token-at-send and draft independence remain covered by token-preserving-draft.test.ts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Contract template ownership UX", () => {
  const list = readFileSync(resolve("components/contracts/contract-template-list.tsx"), "utf8");
  const repo = readFileSync(resolve("lib/contracts/repository.ts"), "utf8");
  const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
  const editPage = readFileSync(
    resolve("app/(app)/contracts/templates/[id]/edit/page.tsx"),
    "utf8",
  );
  const gate = readFileSync(resolve("components/contracts/contract-starter-edit-gate.tsx"), "utf8");
  const page = readFileSync(resolve("app/(app)/contracts/templates/page.tsx"), "utf8");
  const actions = readFileSync(resolve("app/(app)/contracts/actions.ts"), "utf8");
  const provision = readFileSync(resolve("lib/contracts/provision.ts"), "utf8");

  it("list promotes Customize as primary ownership action for HTC starters", () => {
    assert.match(list, /LIBRARY_LABELS\.customize/);
    assert.match(list, /isStarter/);
    assert.match(list, /handleCustomize/);
    assert.match(list, /id: "customize"/);
    assert.match(list, /LIBRARY_LABELS\.useTemplate/);
  });

  it("Customize wires to duplicateTemplateAction (independent venue-owned copy)", () => {
    assert.match(list, /handleCustomize[\s\S]*duplicateTemplateAction/);
    assert.match(gate, /duplicateTemplateAction/);
    const dup = repo.slice(repo.indexOf("export async function duplicateTemplate"));
    const body = dup.slice(0, 600);
    assert.match(body, /insertTemplate\(client, venueId/);
    assert.doesNotMatch(body, /source_master_key|sourceMasterKey/);
  });

  it("server rejects in-place updates to starter rows (no clear-on-edit)", () => {
    const updateRepo = repo.slice(repo.indexOf("export async function updateTemplate"));
    const repoBody = updateRepo.slice(0, updateRepo.indexOf("export async function deleteTemplate"));
    assert.match(repoBody, /STARTER_PROTECTED/);
    assert.doesNotMatch(repoBody, /source_master_key:\s*null/);

    const updateSvc = service.slice(service.indexOf("export async function updateTemplate_"));
    const svcBody = updateSvc.slice(0, updateSvc.indexOf("export async function deleteTemplate_"));
    assert.match(svcBody, /existing\.sourceMasterKey/);
    assert.match(svcBody, /Customize this Hello to Cheers starter/);
  });

  it("edit page gates starters behind Customize banner (no TemplateForm)", () => {
    assert.match(editPage, /ContractStarterEditGate/);
    assert.match(editPage, /sourceMasterKey/);
    assert.match(editPage, /if \(template\.sourceMasterKey\)[\s\S]*ContractStarterEditGate[\s\S]*TemplateForm/);
    const formOnlyAfterGate = editPage.indexOf("ContractStarterEditGate") < editPage.indexOf("<TemplateForm");
    assert.equal(formOnlyAfterGate, true);
    assert.match(gate, /StarterOwnershipBanner/);
  });

  it("venue-owned templates keep Edit and Duplicate; starters do not Duplicate", () => {
    assert.match(list, /LIBRARY_LABELS\.edit/);
    assert.match(list, /LIBRARY_LABELS\.duplicate/);
    assert.match(list, /handleDuplicate/);
    assert.match(list, /\.\.\.\(!isStarter[\s\S]*LIBRARY_LABELS\.duplicate/);
  });

  it("Add another copy of Wedding Venue Agreement remains distinct re-provision", () => {
    assert.match(list, /Add another copy of Wedding Venue Agreement/);
    assert.match(list, /addContractStarterAgainAction/);
    assert.match(actions, /addContractStarterAgainAction/);
    assert.match(actions, /addContractStarterAgain\("CTR-01"\)/);
    assert.match(provision, /source_master_key: sourceMasterKey/);
  });

  it("Use Template still creates drafts from templates", () => {
    assert.match(list, /\/contracts\/new\?templateId=/);
    assert.match(list, /LIBRARY_LABELS\.useTemplate/);
  });

  it("product copy points to Customize for starters", () => {
    assert.match(page, /Customize a starter/);
    assert.match(list, /Customize a Hello to Cheers starter/);
  });

  it("venue ownership checks remain on mutate paths", () => {
    const update = repo.slice(repo.indexOf("export async function updateTemplate"));
    assert.match(update, /\.eq\("venue_id", venueId\)/);
    const dup = repo.slice(repo.indexOf("export async function duplicateTemplate"));
    assert.match(dup, /getTemplate\(client, venueId, sourceId\)/);
  });
});

describe("Contract ownership does not regress token-at-send lifecycle", () => {
  const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");

  it("createContract still stores authored content without resolving tokens", () => {
    const create = service.slice(service.indexOf("export async function createContract"));
    assert.match(create, /Token-preserving draft|content: resolvedInput\.content/);
    assert.doesNotMatch(
      create.slice(0, Math.min(2500, create.indexOf("export async function materializeAuthoredContractContent"))),
      /mergeContent\(resolvedInput\.content/,
    );
  });

  it("sendContract remains the materialize path", () => {
    const send = service.slice(service.indexOf("export async function sendContract"));
    assert.match(send, /materializeAuthoredContractContent/);
  });
});

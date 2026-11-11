import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  contractPickerIneligibilityReason,
  isSelectableForNewContract,
  type ContractPickerStanding,
} from "@/lib/clients/contract-picker";

function standing(partial: Partial<ContractPickerStanding> & Pick<ContractPickerStanding, "id">): ContractPickerStanding {
  return {
    status: "booking",
    excludeFromBusinessReporting: false,
    leadId: null,
    leadSalesStage: null,
    hasEvent: false,
    hasContract: false,
    hasPaymentSchedule: false,
    ...partial,
  };
}

describe("Contract Builder picker eligibility", () => {
  it("selects a legitimate client with a current lead", () => {
    assert.equal(
      isSelectableForNewContract(standing({
        id: "popeye-client",
        leadId: "popeye-lead",
        leadSalesStage: "new_inquiry",
      })),
      true,
    );
  });

  it("selects an existing booked client and a client with a contract or payment plan", () => {
    assert.equal(isSelectableForNewContract(standing({ id: "booked", hasEvent: true })), true);
    assert.equal(isSelectableForNewContract(standing({ id: "contracted", hasContract: true })), true);
    assert.equal(isSelectableForNewContract(standing({ id: "plan", hasPaymentSchedule: true })), true);
  });

  it("excludes cancelled, reporting-excluded, and orphan clients by state", () => {
    assert.equal(contractPickerIneligibilityReason(standing({ id: "c", status: "cancelled", leadId: "l", leadSalesStage: "new_inquiry" })), "cancelled");
    assert.equal(contractPickerIneligibilityReason(standing({ id: "x", excludeFromBusinessReporting: true, hasContract: true })), "reporting_excluded");
    assert.equal(contractPickerIneligibilityReason(standing({ id: "orphan" })), "no_current_standing");
    assert.equal(
      contractPickerIneligibilityReason(standing({
        id: "lost-only",
        leadId: "lost-lead",
        leadSalesStage: "lost",
      })),
      "no_current_standing",
    );
  });

  it("keeps a lost-lead client if they still have a booking, contract, or payment plan", () => {
    assert.equal(
      isSelectableForNewContract(standing({
        id: "historical",
        leadId: "lost-lead",
        leadSalesStage: "cancelled",
        hasEvent: true,
      })),
      true,
    );
  });

  it("does not use display-name string matching", () => {
    const picker = readFileSync(resolve("lib/clients/contract-picker.ts"), "utf8");
    const repo = readFileSync(resolve("lib/clients/repository.ts"), "utf8");
    const start = repo.indexOf("export async function getSelectableContractClients");
    const end = repo.indexOf("export async function getClientAttentionFlags", start + 1);
    const fn = repo.slice(start, end > start ? end : undefined);
    for (const src of [picker, fn]) {
      assert.doesNotMatch(src, /ilike.*test/i);
      assert.doesNotMatch(src, /\/test\|probe\|preview/i);
      assert.doesNotMatch(src, /includes\(["']test["']\)/);
      assert.doesNotMatch(src, /Green\*/);
      assert.doesNotMatch(src, /popeye/i);
    }
  });

  it("keeps existing IDs and commercial relationships read-only in the picker query", () => {
    const repo = readFileSync(resolve("lib/clients/repository.ts"), "utf8");
    const start = repo.indexOf("export async function getSelectableContractClients");
    const end = repo.indexOf("export async function getClientAttentionFlags", start + 1);
    const fn = repo.slice(start, end);
    assert.match(fn, /\.from\("clients"\)/);
    assert.match(fn, /\.from\("contracts"\)\.select\("client_id"\)/);
    assert.match(fn, /\.from\("payment_schedules"\)\.select\("client_id"\)/);
    assert.match(fn, /\.from\("events"\)\.select\("client_id"\)/);
    assert.doesNotMatch(fn, /\.update\(/);
    assert.doesNotMatch(fn, /\.insert\(/);
    assert.doesNotMatch(fn, /\.delete\(/);
  });

  it("Contract Builder new page sources the picker from selectable clients, not getClients()", () => {
    const page = readFileSync(resolve("app/(app)/contracts/new/page.tsx"), "utf8");
    assert.match(page, /getSelectableContractClients/);
    assert.match(page, /ensureContractPickerClient/);
    assert.doesNotMatch(page, /getClients\(/);
  });

  it("lead rename writes the existing linked client identity and does not insert a client", () => {
    const leadsRepo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
    const start = leadsRepo.indexOf("export async function updateLeadInfo");
    const end = leadsRepo.indexOf("export async function setPlannedEventSpace", start + 1);
    const fn = leadsRepo.slice(start, end);
    assert.match(fn, /linkedClientIdentityPatch/);
    assert.match(fn, /\.from\("clients"\)/);
    assert.match(fn, /\.eq\("id", convertedClient\.id\)/);
    assert.doesNotMatch(fn, /\.insert\(/);
    assert.doesNotMatch(fn, /from\("contracts"\)/);
    assert.doesNotMatch(fn, /from\("payment_schedules"\)/);
    assert.doesNotMatch(fn, /from\("contract_signers"\)/);
  });
});

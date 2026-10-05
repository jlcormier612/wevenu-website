import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (p: string) => readFileSync(resolve(p), "utf8");

describe("Create contract path stays canonical", () => {
  it("CTA uses prepareCreateContractAction and /contracts/new", () => {
    const panel = read("components/booking-journey/booking-journey-panel.tsx");
    const handle = panel.slice(
      panel.indexOf("function handleCreateContract"),
      panel.indexOf("function copyShareLink"),
    );
    assert.match(handle, /prepareCreateContractAction/);
    assert.match(handle, /window\.location\.assign\(result\.href\)/);
    assert.doesNotMatch(handle, /\/contracts\/picker/);

    const action = read("app/(app)/booking-journey/actions.ts");
    const fn = action.slice(action.indexOf("export async function prepareCreateContractAction"));
    assert.match(fn, /href: `\/contracts\/new\?\$\{params\.toString\(\)\}`/);
    assert.doesNotMatch(fn.slice(0, 900), /status === "accepted"|invoiceId|paymentLines|booked/);

    const factsUi = read("components/booking-journey/commercial-facts.tsx");
    assert.match(factsUi, /onCreateContract/);
    assert.match(factsUi, /Create contract/);
    assert.doesNotMatch(factsUi, /They accepted\. Collect the deposit/);
  });

  it("contract signing lifecycle remains client first, venue second", () => {
    const signers = read("lib/contracts/signers.ts");
    assert.match(signers, /Draft → Sent to Client → Awaiting Venue Signature → Fully Executed/);
    assert.match(signers, /label: "Sent to Client"/);
    assert.match(signers, /label: "Awaiting Venue Signature"/);
    assert.match(signers, /label: "Fully Executed"/);

    const facts = read("lib/booking-journey/commercial-facts.ts");
    assert.match(facts, /The client signs first\. The venue signs second\./);
    assert.match(facts, /Accepting a package does not execute the contract\./);
  });
});

describe("proposal approval does not finish the commercial journey", () => {
  it("approve RPC does not create a contract, invoice, payment, or Booked write", () => {
    const sql = read("supabase/migrations/20261407100000_customer_action_notification_preferences.sql");
    const fn = sql.slice(sql.lastIndexOf("create or replace function public.approve_commercial_proposal"));
    assert.match(fn, /insert into public.commercial_selections/);
    assert.match(fn, /status = 'approved'/);
    assert.doesNotMatch(fn, /insert into public.contracts/);
    assert.doesNotMatch(fn, /insert into public.invoices/);
    assert.doesNotMatch(fn, /insert into public.payment_schedules/);
    assert.doesNotMatch(fn, /book_relationship/);
    assert.doesNotMatch(fn, /sales_stage = 'booked'/);
    assert.doesNotMatch(fn, /signed_at/);
  });

  it("approveProposalByToken does not execute a contract or mark Booked", () => {
    const service = read("lib/commercial-proposals/service.ts");
    const fn = service.slice(service.indexOf("export async function approveProposalByToken"));
    assert.match(fn, /approve_commercial_proposal/);
    assert.doesNotMatch(fn, /createContract|insertContract|bookClient|book_relationship/);
    assert.doesNotMatch(fn, /sales_stage/);
  });

  it("withdraw remains refused after approval and still leaves a next action before approval", () => {
    const service = read("lib/commercial-proposals/service.ts");
    const fn = service.slice(service.indexOf("export async function withdrawCommercialProposal"));
    const body = fn.slice(0, fn.indexOf("export async function resolveLatestWithdrawnProposal"));
    assert.match(body, /already approved/);
    assert.match(body, /status !== "sent" && existing.status !== "selected"/);
    assert.doesNotMatch(body, /commercial_selections/);
  });
});

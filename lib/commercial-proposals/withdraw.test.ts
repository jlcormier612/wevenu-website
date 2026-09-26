import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const service = readFileSync(resolve("lib/commercial-proposals/service.ts"), "utf8");
const repo = readFileSync(resolve("lib/commercial-proposals/repository.ts"), "utf8");
const facts = readFileSync(resolve("components/booking-journey/commercial-facts.tsx"), "utf8");
const sql = readFileSync(resolve("supabase/migrations/20261405800000_commercial_proposals_l1.sql"), "utf8");

describe("proposal manual takeover", () => {
  it("withdraws sent or selected proposals without creating downstream records", () => {
    const fn = service.slice(service.indexOf("export async function withdrawCommercialProposal"));
    const body = fn.slice(0, fn.indexOf("export async function resolveLatestWithdrawnProposal"));
    assert.match(body, /status !== "sent" && existing.status !== "selected"/);
    assert.match(body, /already approved/);
    assert.match(repo, /status: "withdrawn"/);
    assert.match(repo, /\.in\("status", \["sent", "selected"\]\)/);
    assert.doesNotMatch(body, /createInvoice|createPaymentSchedule|insertClient\(|commercial_selections/);
  });

  it("keeps Continue manually secondary and does not offer Select package while waiting", () => {
    assert.match(facts, /Need to proceed another way/);
    assert.match(facts, /Continue manually/);
    assert.match(facts, /Withdraw proposal & continue manually/);
    assert.match(facts, /Keep waiting for couple/);
    assert.match(facts, /proposalWithdrawn \?/);
    const tokenFn = sql.slice(sql.indexOf("function public.get_commercial_proposal_by_accept_token"));
    assert.match(tokenFn, /status in \('sent', 'selected', 'approved'\)/);
    assert.doesNotMatch(tokenFn.slice(0, 800), /'withdrawn'/);
  });
});
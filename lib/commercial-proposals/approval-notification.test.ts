import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const service = readFileSync(resolve("lib/commercial-proposals/service.ts"), "utf8");
const offer = readFileSync(resolve("lib/booking-journey/offer.ts"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20261426200000_select_proposal_notify_flag.sql"),
  "utf8",
);

describe("combined approval does not emit proposal_selected", () => {
  it("approveProposalByToken selects without notifying, then approves", () => {
    const fn = service.slice(service.indexOf("export async function approveProposalByToken"));
    assert.match(fn, /selectProposalByToken\(token, choices, \{ notify: false \}\)/);
    assert.match(fn, /approve_commercial_proposal/);
  });

  it("standalone select still asks the database to notify", () => {
    const fn = service.slice(
      service.indexOf("export async function selectProposalByToken"),
      service.indexOf("export async function approveProposalByToken"),
    );
    assert.match(fn, /p_notify: notifyOptions\?\.notify !== false/);
    const standalone = offer.slice(offer.indexOf("export async function selectOfferChoicesByToken"));
    assert.match(standalone, /return selectProposalByToken\(token, choices\)/);
    assert.doesNotMatch(
      standalone.slice(0, standalone.indexOf("export async function approveOfferChoicesByToken")),
      /notify: false/,
    );
  });

  it("the selection function skips _notify_proposal_selected only when told", () => {
    assert.match(migration, /p_notify boolean default true/);
    assert.match(migration, /if p_notify is distinct from false then/);
    assert.match(migration, /perform public\._notify_proposal_selected\(v_row\.id\)/);
    assert.match(migration, /drop function if exists public\.select_commercial_proposal\(text, jsonb\)/);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  applyCtr01ContentRefresh,
  classifyCtr01ContentRefresh,
  CTR01_CEREMONY_RECEPTION_ONLY_BLOCK,
  CTR01_NEW_CEREMONY_RECEPTION_BLOCK,
  CTR01_STOCK_CEREMONY_RECEPTION_BLOCK,
  isKnownPriorUntouchedCtr01Master,
  knownPriorUntouchedCtr01Bodies,
} from "@/lib/contracts/ctr01-refresh";
import {
  currentCtr01MasterHasRequiredSmartFields,
  starterContentNeedsSupportedSmartFieldRestore,
  starterContentShouldRefreshFromMaster,
} from "@/lib/contracts/provision";
import { WEDDING_VENUE_AGREEMENT_CONTENT } from "@/lib/contracts/starters";

function prior(name: string): string {
  return readFileSync(resolve(`lib/contracts/ctr01-prior-bodies/${name}`), "utf8");
}

const MIGRATION_106 = resolve(
  "supabase/migrations/20261410600000_contract_starter_ctr01_ceremony_reception_smart_fields.sql",
);
const MIGRATION_108 = resolve(
  "supabase/migrations/20261410800000_contract_starter_ctr01_additional_event_spaces.sql",
);

/** Priors embedded in the historical 106 migration (before 082 was added). */
const MIGRATION_106_PRIOR_NAMES = [
  "078.txt",
  "081.txt",
  "081-no-balance-confirmation.txt",
  "prior-code-master.txt",
  "prior-code-master-leading-nl.txt",
  "081-no-leading-nl.txt",
] as const;

describe("CTR-01 refresh classification", () => {
  it("exact 078 → full refresh succeeds", () => {
    const body = prior("078.txt");
    assert.equal(classifyCtr01ContentRefresh(body), "full_refresh");
    const next = applyCtr01ContentRefresh(body);
    assert.equal(next.action, "full_refresh");
    assert.equal(next.content, WEDDING_VENUE_AGREEMENT_CONTENT);
    assert.match(next.content, /\{\{ceremony_space\}\}/);
    assert.match(next.content, /\{\{reception_space\}\}/);
    assert.match(next.content, /\{\{additional_event_spaces\}\}/);
  });

  it("exact 081 → full refresh succeeds", () => {
    const body = prior("081.txt");
    assert.equal(classifyCtr01ContentRefresh(body), "full_refresh");
    assert.equal(applyCtr01ContentRefresh(body).content, WEDDING_VENUE_AGREEMENT_CONTENT);
  });

  it("exact 082 ceremony/reception master → full refresh to Additional starter", () => {
    const body = prior("082-ceremony-reception-event-spaces.txt");
    assert.ok(isKnownPriorUntouchedCtr01Master(body));
    assert.equal(classifyCtr01ContentRefresh(body), "full_refresh");
    const next = applyCtr01ContentRefresh(body);
    assert.equal(next.content, WEDDING_VENUE_AGREEMENT_CONTENT);
    assert.match(next.content, /\{\{additional_event_spaces\}\}/);
    assert.doesNotMatch(next.content, /\{\{event_spaces\}\}/);
    assert.doesNotMatch(next.content, /VENUE & EVENT SPACES/);
  });

  it("exact proven platform variants → full refresh succeeds", () => {
    for (const name of [
      "081-no-balance-confirmation.txt",
      "prior-code-master.txt",
      "prior-code-master-leading-nl.txt",
      "081-no-leading-nl.txt",
    ]) {
      const body = prior(name);
      assert.ok(isKnownPriorUntouchedCtr01Master(body), name);
      assert.equal(classifyCtr01ContentRefresh(body), "full_refresh", name);
      assert.equal(applyCtr01ContentRefresh(body).content, WEDDING_VENUE_AGREEMENT_CONTENT, name);
    }
  });

  it("DESTRUCTIVE REGRESSION: CTR-01 + one authored sentence + missing Smart Fields → never full master overwrite", () => {
    const authored = "Our cancellation policy requires 90 days notice and a written release.";
    const body = prior("081.txt").replace(
      "Add your venue's approved cancellation and rescheduling policy here.",
      authored,
    );
    assert.equal(isKnownPriorUntouchedCtr01Master(body), false);
    assert.equal(starterContentNeedsSupportedSmartFieldRestore(body), true);
    assert.doesNotMatch(body, /\{\{ceremony_space\}\}/);
    assert.doesNotMatch(body, /\{\{reception_space\}\}/);

    assert.notEqual(classifyCtr01ContentRefresh(body), "full_refresh");
    const next = applyCtr01ContentRefresh(body);
    assert.notEqual(next.content, WEDDING_VENUE_AGREEMENT_CONTENT);

    assert.ok(next.content.includes(authored));

    assert.equal(next.action, "surgical");
    const beforeOutside = body.replace(CTR01_STOCK_CEREMONY_RECEPTION_BLOCK, "<<<BLOCK>>>");
    const afterOutside = next.content.replace(CTR01_NEW_CEREMONY_RECEPTION_BLOCK, "<<<BLOCK>>>");
    assert.equal(afterOutside, beforeOutside);
    assert.match(next.content, /\{\{additional_event_spaces\}\}/);
  });

  it("customized body + exact stock Ceremony/Reception block → only exact block changes", () => {
    const customizedPolicy = "Venue-authored alcohol rules apply to every event.";
    const body = prior("081.txt").replace(
      "Add your venue's approved alcohol policy and requirements here.",
      customizedPolicy,
    );
    const beforeOutside = body.replace(CTR01_STOCK_CEREMONY_RECEPTION_BLOCK, "<<<BLOCK>>>");
    const next = applyCtr01ContentRefresh(body);
    assert.equal(next.action, "surgical");
    const afterOutside = next.content.replace(CTR01_NEW_CEREMONY_RECEPTION_BLOCK, "<<<BLOCK>>>");
    assert.equal(afterOutside, beforeOutside);
    assert.match(next.content, new RegExp(customizedPolicy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(next.content, /\{\{ceremony_space\}\}/);
    assert.match(next.content, /\{\{reception_space\}\}/);
    assert.match(next.content, /\{\{additional_event_spaces\}\}/);
    assert.doesNotMatch(next.content, /Add your venue's approved ceremony timing/);
  });

  it("customized body with ceremony/reception-only Smart Fields → surgical Additional insert", () => {
    const body = prior("082-ceremony-reception-event-spaces.txt").replace(
      "Add your venue's approved alcohol policy and requirements here.",
      "Venue-authored alcohol rules.",
    );
    assert.equal(isKnownPriorUntouchedCtr01Master(body), false);
    assert.equal(classifyCtr01ContentRefresh(body), "surgical");
    const next = applyCtr01ContentRefresh(body);
    assert.equal(next.action, "surgical");
    assert.match(next.content, /\{\{additional_event_spaces\}\}/);
    assert.match(next.content, /Venue-authored alcohol rules/);
    assert.match(next.content, /\{\{event_spaces\}\}/); // authored layout keeps legacy key
    const beforeOutside = body.replace(CTR01_CEREMONY_RECEPTION_ONLY_BLOCK, "<<<BLOCK>>>");
    const afterOutside = next.content.replace(CTR01_NEW_CEREMONY_RECEPTION_BLOCK, "<<<BLOCK>>>");
    assert.equal(afterOutside, beforeOutside);
  });

  it("already has additional_event_spaces → no double insert", () => {
    const body =
      prior("082-ceremony-reception-event-spaces.txt").replace(
        CTR01_CEREMONY_RECEPTION_ONLY_BLOCK,
        CTR01_NEW_CEREMONY_RECEPTION_BLOCK,
      ) + "\nVenue-authored footer.";
    assert.equal(classifyCtr01ContentRefresh(body), "none");
    assert.equal(applyCtr01ContentRefresh(body).content, body);
  });

  it("customized Ceremony wording → unchanged", () => {
    const body = prior("081.txt").replace(
      "Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.",
      "Ceremony begins at 4:00 PM on the Garden Lawn.",
    );
    assert.equal(classifyCtr01ContentRefresh(body), "none");
    assert.equal(applyCtr01ContentRefresh(body).content, body);
  });

  it("customized Reception wording → unchanged", () => {
    const body = prior("081.txt").replace(
      "Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.",
      "Reception follows in the Barn.",
    );
    assert.equal(classifyCtr01ContentRefresh(body), "none");
    assert.equal(applyCtr01ContentRefresh(body).content, body);
  });

  it("duplicate stock Ceremony/Reception blocks → unchanged", () => {
    const body = prior("081.txt") + "\n\n" + CTR01_STOCK_CEREMONY_RECEPTION_BLOCK;
    assert.equal(classifyCtr01ContentRefresh(body), "none");
    assert.equal(applyCtr01ContentRefresh(body).content, body);
  });

  it("source_master_key alone must never authorize replacement", () => {
    const customized = "Totally custom venue agreement with no CTR-01 stock ceremony block.";
    assert.equal(classifyCtr01ContentRefresh(customized), "none");
    assert.equal(applyCtr01ContentRefresh(customized).content, customized);
    assert.equal(starterContentShouldRefreshFromMaster(customized), false);
  });

  it("source_master_key NULL → untouched (classification is content-only; migration scopes key)", () => {
    const authored = "Venue-authored agreement. Ceremony on the lawn. Reception in the barn.";
    assert.equal(classifyCtr01ContentRefresh(authored), "none");
    assert.equal(applyCtr01ContentRefresh(authored).content, authored);
    const sql = readFileSync(MIGRATION_106, "utf8");
    assert.match(sql, /Customer-authored templates \(source_master_key IS NULL\) are untouched/);
    const updates = [...sql.matchAll(/UPDATE public\.contract_templates[\s\S]*?WHERE source_master_key = 'CTR-01'/g)];
    assert.ok(updates.length >= 2);
  });

  it("contracts table → untouched", () => {
    const sql = readFileSync(MIGRATION_106, "utf8");
    assert.doesNotMatch(sql, /UPDATE public\.contracts\b/);
    assert.doesNotMatch(sql, /INSERT INTO public\.contracts\b/i);
  });

  it("missing Smart Field tokens alone must never authorize replacement", () => {
    const almost = WEDDING_VENUE_AGREEMENT_CONTENT
      .replace("{{ceremony_space}}", "Ceremony space TBD")
      .replace("{{reception_space}}", "Reception space TBD");
    assert.equal(starterContentNeedsSupportedSmartFieldRestore(almost), true);
    assert.equal(classifyCtr01ContentRefresh(almost), "none");
    assert.equal(applyCtr01ContentRefresh(almost).content, almost);
  });

  it("new provision master contains ceremony, reception, and additional_event_spaces", () => {
    assert.equal(currentCtr01MasterHasRequiredSmartFields(), true);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{ceremony_space\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{reception_space\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{additional_event_spaces\}\}/);
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{event_spaces\}\}/);
  });

  it("allowlist has no fuzzy matching — only exact bodies", () => {
    const body = prior("081.txt") + " ";
    assert.equal(isKnownPriorUntouchedCtr01Master(body), false);
    assert.notEqual(classifyCtr01ContentRefresh(body), "full_refresh");
    assert.equal(classifyCtr01ContentRefresh(body), "surgical");
    assert.ok(knownPriorUntouchedCtr01Bodies().length >= 7);
  });
});

describe("CTR-01 migration 106 SQL safety (historical)", () => {
  const sql = readFileSync(MIGRATION_106, "utf8");

  it("does not refresh by source_master_key alone", () => {
    assert.match(sql, /content IN \(/);
    assert.match(sql, /source_master_key = 'CTR-01'/);
    assert.match(sql, /length\(content\)/);
    assert.match(sql, /replace\(/);
    assert.doesNotMatch(sql, /UPDATE public\.contracts\b/);
  });

  it("embeds the exact stock and ceremony/reception-only blocks", () => {
    assert.match(sql, /Add your venue's approved ceremony timing and location language here/);
    assert.match(sql, /\{\{ceremony_space\}\}/);
    assert.match(sql, /\{\{reception_space\}\}/);
    assert.ok(sql.includes(CTR01_STOCK_CEREMONY_RECEPTION_BLOCK));
    assert.ok(sql.includes(CTR01_CEREMONY_RECEPTION_ONLY_BLOCK));
    assert.doesNotMatch(sql, /\{\{additional_event_spaces\}\}/);
  });

  it("migration prior bodies are byte-exact for the 106 allowlist", () => {
    const priors = [...sql.matchAll(/\$ctr01_prior\d+\$(.*?)\$ctr01_prior\d+\$/gs)].map((m) => m[1]);
    assert.equal(priors.length, MIGRATION_106_PRIOR_NAMES.length);
    for (const name of MIGRATION_106_PRIOR_NAMES) {
      assert.ok(priors.includes(prior(name)), name);
    }
    const stock = [...sql.matchAll(/\$ctr01_stock_block\d*\$([\s\S]*?)\$ctr01_stock_block\d*\$/g)].map(
      (m) => m[1],
    );
    assert.ok(stock.length >= 1);
    for (const s of stock) {
      assert.equal(s, CTR01_STOCK_CEREMONY_RECEPTION_BLOCK);
    }
    const news = [...sql.matchAll(/\$ctr01_new_block\$([\s\S]*?)\$ctr01_new_block\$/g)].map((m) => m[1]);
    assert.equal(news.length, 1);
    assert.equal(news[0], CTR01_CEREMONY_RECEPTION_ONLY_BLOCK);
  });

  it("customer-authored null-key templates are out of scope", () => {
    assert.match(sql, /source_master_key IS NULL/);
  });
});

describe("CTR-01 migration 108 additional_event_spaces SQL safety", () => {
  const sql = readFileSync(MIGRATION_108, "utf8");

  it("does not refresh by source_master_key alone and never touches contracts", () => {
    assert.match(sql, /content IN \(/);
    assert.match(sql, /source_master_key = 'CTR-01'/);
    assert.doesNotMatch(sql, /UPDATE public\.contracts\b/);
    assert.match(sql, /Customer-authored templates \(source_master_key IS NULL\) are untouched/);
  });

  it("full-refresh target equals current master with additional_event_spaces", () => {
    assert.ok(sql.includes(WEDDING_VENUE_AGREEMENT_CONTENT));
    assert.match(sql, /\{\{additional_event_spaces\}\}/);
  });

  it("embeds all current prior fixtures including 082", () => {
    const fixtures = knownPriorUntouchedCtr01Bodies();
    const priors = [...sql.matchAll(/\$ctr01_prior\d+\$(.*?)\$ctr01_prior\d+\$/gs)].map((m) => m[1]);
    assert.equal(priors.length, fixtures.length);
    for (const body of fixtures) {
      assert.ok(priors.includes(body), `fixture missing from migration IN list (len=${body.length})`);
    }
  });

  it("surgical blocks match runtime constants", () => {
    assert.ok(sql.includes(CTR01_STOCK_CEREMONY_RECEPTION_BLOCK));
    assert.ok(sql.includes(CTR01_CEREMONY_RECEPTION_ONLY_BLOCK));
    assert.ok(sql.includes(CTR01_NEW_CEREMONY_RECEPTION_BLOCK));
  });
});

describe("updateTemplate clears source_master_key on venue edit", () => {
  it("repository update sets source_master_key null", () => {
    const repo = readFileSync(resolve("lib/contracts/repository.ts"), "utf8");
    const fn = repo.slice(repo.indexOf("export async function updateTemplate"));
    const body = fn.slice(0, fn.indexOf("export async function deleteTemplate"));
    assert.match(body, /source_master_key:\s*null/);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isDueToday, isOverdue } from "@/lib/leads/constants";

describe("single customer-facing follow-up date", () => {
  const card = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
  const dashboard = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
  const observations = readFileSync(resolve("lib/luv/observations.ts"), "utf8");

  it("renders next action text without next_action_due as a second date", () => {
    assert.match(card, /label="Next action"/);
    assert.match(card, /value=\{lead\.nextActionText\}/);
    assert.doesNotMatch(card, /nextActionDue \? ` — by/);
    assert.doesNotMatch(card, /label="Due date"/);
    assert.match(card, /label="Follow-up"/);
    assert.match(card, /label="Follow-up date"/);
    assert.match(card, /value=\{formatDate\(lead\.followUpDate\)\}/);
  });

  it("still keeps nextActionDue in the save payload so existing values are not wiped", () => {
    assert.match(card, /updateRelationshipAction\(lead\.id, input/);
    const constants = readFileSync(resolve("lib/leads/constants.ts"), "utf8");
    assert.match(constants, /nextActionDue: lead\?\.nextActionDue/);
    const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
    assert.match(repo, /next_action_due: input\.nextActionDue/);
  });

  it("overdue and due-today stay on follow_up_date only", () => {
    assert.match(dashboard, /l\.followUpDate && l\.followUpDate < today/);
    assert.match(dashboard, /l\.followUpDate === today/);
    assert.equal(isOverdue("2020-01-01"), true);
    assert.equal(isOverdue("2099-12-31"), false);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    assert.equal(isDueToday(`${yyyy}-${mm}-${dd}`), true);
    assert.equal(isDueToday("2099-12-31"), false);
  });

  it("Luv no-follow-up observation still keys off follow_up_date null", () => {
    assert.match(observations, /\.is\("follow_up_date", null\)/);
    assert.doesNotMatch(observations, /next_action_due/);
  });

  it("next_action_due alone does not appear as the Follow-up display value", () => {
    assert.doesNotMatch(card, /formatDate\(lead\.nextActionDue\)/);
    assert.match(card, /formatDate\(lead\.followUpDate\)/);
  });
});

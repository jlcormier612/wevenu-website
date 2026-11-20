import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("NAV-PERF soft Filter — architecture", () => {
  const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
  const actions = readFileSync(resolve("app/(app)/leads/actions.ts"), "utf8");
  const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");
  const layout = readFileSync(resolve("app/(app)/layout.tsx"), "utf8");

  it("uses replaceLeadsListAction instead of router.replace for filter commits", () => {
    assert.match(list, /replaceLeadsListAction/);
    assert.match(list, /applySoftFilter/);
    assert.match(list, /history\.(pushState|replaceState)/);
    assert.match(list, /popstate/);
    assert.doesNotMatch(list, /router\.replace\(href\)/);
    assert.doesNotMatch(list, /router\.replace\("\/leads"\)/);
  });

  it("reuses getLeadsListPage for soft replace and Show more", () => {
    assert.match(actions, /export async function replaceLeadsListAction/);
    assert.match(actions, /export async function loadMoreLeadsAction/);
    assert.match(actions, /fetchLeadsListWindow/);
    assert.match(actions, /getLeadsListPage/);
    assert.equal(
      (actions.match(/getLeadsListPage/g) ?? []).length >= 1,
      true,
    );
  });

  it("refuses suspended venues on the shared list path", () => {
    assert.match(service, /accessDisabled/);
    assert.match(service, /accountStatus === "suspended"/);
    assert.match(service, /accessDenied: "suspended"/);
    assert.match(actions, /accessDenied === "suspended"/);
  });

  it("does not modify workspace layout for soft Filter", () => {
    assert.match(layout, /layout_gates_parallel/);
    assert.doesNotMatch(layout, /replaceLeadsListAction/);
    assert.doesNotMatch(layout, /soft.?filter/i);
  });
});

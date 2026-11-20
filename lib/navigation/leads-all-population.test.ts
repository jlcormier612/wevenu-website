import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  navAttentionHref,
  UNSEEN_LEADS_ATTENTION_HREF,
} from "@/lib/navigation/attention";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Leads All vs unseen attention", () => {
  it("/leads with no params is the full active population and does not default unseen", () => {
    const page = read("app/(app)/leads/page.tsx");
    const island = read("components/leads/leads-list-island.tsx");
    assert.match(page, /LeadsListIsland/);
    assert.match(island, /getLeadsListPage/);
    assert.match(island, /attention === "unseen"/);
    assert.doesNotMatch(island, /initialAttention = "unseen"/);
    const list = read("components/leads/lead-list.tsx");
    assert.match(list, /: "all"/);
  });

  it("Leads nav does not redefine All as unseen", () => {
    assert.equal(navAttentionHref("leads", "/leads", 4), "/leads");
    assert.equal(navAttentionHref("leads", "/leads", 0), "/leads");
    const nav = read("lib/navigation/attention.ts");
    assert.match(nav, /UNSEEN_LEADS_ATTENTION_HREF/);
    assert.equal(UNSEEN_LEADS_ATTENTION_HREF, "/leads?attention=unseen");
    const sidebar = read("components/shell/sidebar-nav.tsx");
    assert.match(sidebar, /UNSEEN_LEADS_ATTENTION_HREF/);
    assert.match(sidebar, /item\.id === "leads"/);
  });

  it("/leads?attention=unseen remains an explicit attention view", () => {
    const island = read("components/leads/leads-list-island.tsx");
    const list = read("components/leads/lead-list.tsx");
    const query = read("lib/leads/list-query.ts");
    assert.match(island, /attention === "unseen"/);
    assert.match(list, /attentionFilter === "unseen"/);
    assert.match(query, /isUnseenLeadAttention/);
  });

  it("All and Show all active leads clear unseen attention and strip the URL", () => {
    const list = read("components/leads/lead-list.tsx");
    assert.match(list, /function showAllActiveLeads\(\)/);
    assert.match(list, /setAttentionFilter\("all"\)/);
    assert.match(list, /router\.replace\("\/leads"\)/);
    const showAll = list.slice(list.indexOf("function showAllActiveLeads"));
    assert.match(showAll, /setAttentionFilter\("all"\)/);
    assert.match(list, /chip\.key === "all"/);
    assert.match(list, /showAllActiveLeads\(\)/);
    assert.match(list, /Showing unseen open leads/);
  });

  it("stage counts on All use the full active queue, not the unseen subset", () => {
    const query = read("lib/leads/list-query.ts");
    const counts = query.slice(
      query.indexOf("export function buildStatusCounts"),
      query.indexOf("export function buildEventTypeCounts"),
    );
    assert.match(counts, /allLeads\.filter\(isActiveQueueLead\)/);
    assert.doesNotMatch(counts, /attention === "unseen"/);
    assert.match(counts, /map\.set\("lost"/);
    assert.match(counts, /currentBookedCount/);
  });

  it("Booked and Lost remain outcomes outside All", () => {
    const query = read("lib/leads/list-query.ts");
    assert.match(query, /isOpenLeadLifecycle/);
    assert.match(query, /isLostLead/);
    assert.match(query, /outcome === "lost"/);
    const list = read("components/leads/lead-list.tsx");
    assert.match(list, /kind: "booked"/);
    assert.match(list, /href="\/clients\?filter=all"/);
  });

  it("markLeadVenueSeen is venue_seen_at only and does not change All membership", () => {
    const service = read("lib/navigation/attention-service.ts");
    assert.match(service, /export async function markLeadVenueSeen/);
    assert.match(service, /venue_seen_at/);
    assert.doesNotMatch(service.slice(service.indexOf("export async function markLeadVenueSeen"), service.indexOf("export async function markVenueToursSeen")), /sales_stage/);
    const query = read("lib/leads/list-query.ts");
    assert.match(query, /attention === "unseen"/);
    assert.match(query, /isUnseenLeadAttention/);
    const filterFn = query.slice(
      query.indexOf("export function filterLeadsForList"),
      query.indexOf("export function paginateLeads"),
    );
    const unseenGate = filterFn.indexOf('attention === "unseen"');
    assert.ok(unseenGate > 0);
    const beforeUnseen = filterFn.slice(0, unseenGate);
    assert.doesNotMatch(beforeUnseen, /venueSeenAt/);
  });

  it("a new unseen lead does not hide previously seen active leads from All", () => {
    const query = read("lib/leads/list-query.ts");
    const filterFn = query.slice(
      query.indexOf("export function filterLeadsForList"),
      query.indexOf("export function paginateLeads"),
    );
    assert.match(filterFn, /attention === "unseen"/);
    assert.doesNotMatch(
      filterFn.slice(0, filterFn.indexOf('attention === "unseen"')),
      /venueSeenAt/,
    );
  });
});

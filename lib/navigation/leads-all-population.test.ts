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
    assert.match(page, /getLeads\(\)/);
    assert.match(page, /attention === "unseen" \? "unseen"/);
    assert.doesNotMatch(page, /initialAttention = "unseen"/);
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
    const page = read("app/(app)/leads/page.tsx");
    const list = read("components/leads/lead-list.tsx");
    assert.match(page, /attention === "unseen"/);
    assert.match(list, /attentionFilter === "unseen"/);
    assert.match(list, /attentionFilter === "unseen"/);
    assert.match(list, /if \(l\.venueSeenAt\) return false/);
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
    const list = read("components/leads/lead-list.tsx");
    const counts = list.slice(
      list.indexOf("const statusCounts"),
      list.indexOf("const activeEventTypes"),
    );
    assert.match(counts, /const population = queue;/);
    assert.doesNotMatch(counts, /attentionFilter === "unseen"/);
    assert.match(counts, /map\.set\("lost"/);
    assert.match(counts, /currentBookedCount/);
  });

  it("Booked and Lost remain outcomes outside All", () => {
    const list = read("components/leads/lead-list.tsx");
    assert.match(list, /const queue = React\.useMemo\(/);
    assert.match(list, /isOpenLeadLifecycle\(l\.salesStage \?\? l\.status\)/);
    assert.match(list, /statusFilter === "lost" \? leads\.filter\(isLostLead\) : queue/);
  });

  it("markLeadVenueSeen is venue_seen_at only and does not change All membership", () => {
    const service = read("lib/navigation/attention-service.ts");
    assert.match(service, /export async function markLeadVenueSeen/);
    assert.match(service, /venue_seen_at/);
    assert.doesNotMatch(service.slice(service.indexOf("export async function markLeadVenueSeen"), service.indexOf("export async function markVenueToursSeen")), /sales_stage/);
    const list = read("components/leads/lead-list.tsx");
    assert.match(list, /if \(attentionFilter === "unseen"\)/);
    assert.match(list, /if \(l\.venueSeenAt\) return false/);
    const allFilteredStart = list.indexOf("const filtered");
    const unseenGate = list.indexOf('if (attentionFilter === "unseen")');
    assert.ok(unseenGate > allFilteredStart);
    const beforeUnseen = list.slice(allFilteredStart, unseenGate);
    assert.doesNotMatch(beforeUnseen, /venueSeenAt/);
  });

  it("a new unseen lead does not hide previously seen active leads from All", () => {
    const list = read("components/leads/lead-list.tsx");
    const filtered = list.slice(list.indexOf("const filtered"), list.indexOf("const statusCounts"));
    assert.match(filtered, /attentionFilter === "unseen"/);
    assert.doesNotMatch(
      filtered.slice(0, filtered.indexOf('if (attentionFilter === "unseen")')),
      /venueSeenAt/,
    );
  });
});

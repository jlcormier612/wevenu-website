import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendLeadWindow,
  buildLeadsListHref,
  hasMoreLeads,
  nextSearchDraftFromCommitted,
  parseLeadsListNavState,
  progressiveWindowLabel,
  shouldCommitSearchDraft,
} from "@/lib/leads/list-navigation";
import { LEADS_PAGE_SIZE, sliceLeadWindow } from "@/lib/leads/list-query";

describe("Leads list navigation state consistency", () => {
  it("does not commit a stale debounced generation", () => {
    assert.equal(
      shouldCommitSearchDraft({
        draft: "ab",
        committedUrlQuery: "",
        generation: 1,
        currentGeneration: 2,
      }),
      false,
    );
    assert.equal(
      shouldCommitSearchDraft({
        draft: "ab",
        committedUrlQuery: "",
        generation: 2,
        currentGeneration: 2,
      }),
      true,
    );
    assert.equal(
      shouldCommitSearchDraft({
        draft: "same",
        committedUrlQuery: "same",
        generation: 3,
        currentGeneration: 3,
      }),
      false,
    );
  });

  it("keeps a newer search draft when a slower URL commit arrives", () => {
    assert.equal(
      nextSearchDraftFromCommitted({
        draft: "alice",
        committedUrlQuery: "al",
        lastRequestedQuery: "al",
      }),
      "alice",
    );
    assert.equal(
      nextSearchDraftFromCommitted({
        draft: "al",
        committedUrlQuery: "al",
        lastRequestedQuery: "al",
      }),
      "al",
    );
    assert.equal(
      nextSearchDraftFromCommitted({
        draft: "bob",
        committedUrlQuery: "",
        lastRequestedQuery: "bob",
      }),
      "",
    );
  });

  it("builds deep-link hrefs without progressive offset/page params", () => {
    const href = buildLeadsListHref({
      q: "garden",
      status: "new_inquiry",
      eventType: "wedding",
      sort: "az",
      attention: "unseen",
      outcome: "active",
    });
    assert.match(href, /q=garden/);
    assert.match(href, /stage=new_inquiry/);
    assert.match(href, /eventType=wedding/);
    assert.match(href, /sort=az/);
    assert.match(href, /attention=unseen/);
    assert.doesNotMatch(href, /page=/);
    assert.doesNotMatch(href, /offset=/);
  });

  it("clear filters href is bare /leads", () => {
    assert.equal(
      buildLeadsListHref({
        q: "",
        status: "all",
        eventType: "all",
        sort: "newest",
        attention: "all",
        outcome: "active",
      }),
      "/leads",
    );
  });

  it("round-trips href parse for soft Filter / popstate", () => {
    const state = {
      q: "garden",
      status: "tour_scheduled",
      eventType: "wedding",
      sort: "az" as const,
      attention: "unseen" as const,
      outcome: "active" as const,
    };
    const href = buildLeadsListHref(state);
    const qs = href.includes("?") ? href.slice(href.indexOf("?")) : "";
    assert.deepEqual(parseLeadsListNavState(qs), state);
    assert.deepEqual(parseLeadsListNavState("view=lost"), {
      q: "",
      status: "lost",
      eventType: "all",
      sort: "newest",
      attention: "all",
      outcome: "lost",
    });
  });
});

describe("Leads progressive window", () => {
  it("defaults chunk size to 20", () => {
    assert.equal(LEADS_PAGE_SIZE, 20);
  });

  it("loads 363 matching leads in 20-row windows with no duplicates or omissions", () => {
    const population = Array.from({ length: 363 }, (_, i) => ({ id: `lead-${i}` }));
    const seen = new Set<string>();
    let offset = 0;
    let shown: Array<{ id: string }> = [];
    while (hasMoreLeads(shown.length, population.length)) {
      const window = sliceLeadWindow(population, offset, LEADS_PAGE_SIZE);
      assert.ok(window.pageItems.length <= LEADS_PAGE_SIZE);
      shown = appendLeadWindow(shown, window.pageItems);
      for (const row of window.pageItems) {
        assert.equal(seen.has(row.id), false, `duplicate ${row.id}`);
        seen.add(row.id);
      }
      offset = shown.length;
      if (!window.hasMore) break;
    }
    assert.equal(seen.size, 363);
    assert.equal(shown.length, 363);
    assert.equal(hasMoreLeads(shown.length, 363), false);
    assert.equal(progressiveWindowLabel(20, 363), "Showing 20 of 363 leads");
    assert.equal(progressiveWindowLabel(363, 363), "Showing 363 of 363 leads");
  });

  it("appendLeadWindow ignores duplicate ids from overlapping fetches", () => {
    const a = [{ id: "1" }, { id: "2" }];
    const b = [{ id: "2" }, { id: "3" }];
    assert.deepEqual(appendLeadWindow(a, b).map((r) => r.id), ["1", "2", "3"]);
  });
});

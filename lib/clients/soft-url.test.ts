import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  clientsFilterHref,
  filterFromPopState,
  resolveClientListFilter,
  shouldPersistStickyFilter,
  softClientsHistoryState,
  CLIENTS_SOFT_FILTER_STATE_KEY,
} from "@/lib/clients/soft-url";

describe("Clients Soft-URL helpers", () => {
  it("resolves soft committed over URL over sticky", () => {
    assert.equal(
      resolveClientListFilter({
        softCommitted: "coming_up",
        urlFilter: "all",
        stickyFilter: "past",
      }),
      "coming_up",
    );
    assert.equal(
      resolveClientListFilter({
        softCommitted: null,
        urlFilter: "needs_attention",
        stickyFilter: "past",
      }),
      "needs_attention",
    );
    assert.equal(
      resolveClientListFilter({
        softCommitted: null,
        urlFilter: null,
        stickyFilter: "contacts",
      }),
      "contacts",
    );
  });

  it("preserves unrelated query params when building filter href", () => {
    assert.equal(
      clientsFilterHref("/clients", "utm=1&filter=all", "coming_up"),
      "/clients?utm=1&filter=coming_up",
    );
  });

  it("does not persist portal_activation as sticky", () => {
    assert.equal(shouldPersistStickyFilter("portal_activation"), false);
    assert.equal(shouldPersistStickyFilter("all"), true);
  });

  it("reads filter from popstate state or location search", () => {
    assert.equal(
      filterFromPopState(softClientsHistoryState("cancelled"), "?filter=all"),
      "cancelled",
    );
    assert.equal(filterFromPopState(null, "?filter=past"), "past");
    assert.equal(CLIENTS_SOFT_FILTER_STATE_KEY, "htcClientsSoftFilter");
  });
});

describe("Clients Soft-URL architecture", () => {
  it("ClientList chips do not call router.replace for filters", () => {
    const src = readFileSync(
      join(process.cwd(), "components/clients/client-list.tsx"),
      "utf8",
    );
    assert.match(src, /history\.(push|replace)State/);
    assert.match(src, /resolveClientListFilter|softCommitted|setSoftCommitted/);
    assert.doesNotMatch(src, /router\.replace\(`\$\{pathname\}\?\$\{params/);
  });

  it("does not modify workspace layout for Soft-URL", () => {
    const layout = readFileSync(join(process.cwd(), "app/(app)/layout.tsx"), "utf8");
    assert.match(layout, /force-dynamic/);
    // Soft-URL must not have been introduced into layout
    assert.doesNotMatch(layout, /softClients|Soft-URL|clients soft/i);
  });
});

/**
 * NAV-PERF Wave 1 — sidebar prefetch off + attention contract scan slim + TTL refresh.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  countVenueActionRequiredContracts,
  rollupContractsToCurrentAgreements,
} from "@/lib/contracts/list-filters";
import type { Contract } from "@/lib/contracts/types";
import { NAV_ATTENTION_REFRESH_EVENT } from "@/lib/navigation/attention";

function contract(partial: Partial<Contract> & Pick<Contract, "id" | "status">): Contract {
  return {
    venueId: "v1",
    clientId: null,
    eventId: null,
    templateId: null,
    title: partial.title ?? "Agreement",
    content: "",
    executionOrigin: "htc",
    signToken: "",
    signerName: null,
    signedAt: null,
    sentAt: null,
    expiresAt: null,
    createdAt: partial.createdAt ?? "2026-09-01T00:00:00.000Z",
    updatedAt: partial.createdAt ?? "2026-09-01T00:00:00.000Z",
    amendsContractId: null,
    brandingSnapshot: null,
    clientName: null,
    clientEmail: null,
    eventDate: null,
    venueSigned: false,
    requiredClientTotal: 1,
    requiredClientSigned: 0,
    ...partial,
  };
}

describe("NAV-PERF Wave 1 — sidebar prefetch", () => {
  it("disables automatic prefetch on primary sidebar Links only", () => {
    const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
    assert.match(sidebar, /prefetch=\{false\}/);
    assert.match(sidebar, /aria-label="Primary"/);
    // Still uses Next Link for real navigation.
    assert.match(sidebar, /from "next\/link"/);
  });

  it("disables prefetch on Refer & Earn header CTA (was a hot RSC prefetch)", () => {
    const cta = readFileSync(resolve("components/shell/refer-earn-nav-cta.tsx"), "utf8");
    assert.match(cta, /prefetch=\{false\}/);
  });
});

describe("NAV-PERF Wave 1 — attention TTL + force refresh", () => {
  it("uses a bounded TTL and still honors explicit refresh events", () => {
    const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
    assert.match(sidebar, /ATTENTION_TTL_MS\s*=\s*60_000/);
    assert.match(sidebar, /loadAttention\(false\)/);
    assert.match(sidebar, /loadAttention\(true\)/);
    assert.equal(NAV_ATTENTION_REFRESH_EVENT, "htc:nav-attention-refresh");
    assert.match(sidebar, /addEventListener\(NAV_ATTENTION_REFRESH_EVENT/);
  });

  it("lead and tours pages force refresh after mark-seen mutations", () => {
    const lead = readFileSync(resolve("app/(app)/leads/[id]/page.tsx"), "utf8");
    const tours = readFileSync(resolve("app/(app)/tours/page.tsx"), "utf8");
    const mount = readFileSync(
      resolve("components/shell/nav-attention-refresh-on-mount.tsx"),
      "utf8",
    );
    assert.match(mount, /requestNavAttentionRefresh/);
    assert.match(lead, /NavAttentionRefreshOnMount/);
    assert.match(lead, /markLeadVenueSeen/);
    assert.match(tours, /NavAttentionRefreshOnMount/);
    assert.match(tours, /markVenueToursSeen/);
  });
});

describe("NAV-PERF Wave 1 — slim contract badge scan semantics", () => {
  it("attention service loads only draft/sent and signers for sent", () => {
    const attention = readFileSync(resolve("lib/navigation/attention-service.ts"), "utf8");
    assert.match(attention, /\.in\("status",\s*\["draft",\s*"sent"\]\)/);
    assert.match(attention, /sentIds/);
    assert.doesNotMatch(attention, /select\("id, status, expires_at, created_at, amends_contract_id, title"\)/);
    assert.doesNotMatch(attention, /\bgetContracts\s*\(/);
  });

  it("draft+sent tip set preserves action-required counts after rollup", () => {
    // Same fixture shape as contracts list-filters: signed v1 + draft amendment tip.
    const v1 = contract({
      id: "a",
      status: "signed",
      venueSigned: true,
      requiredClientSigned: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    const v2 = contract({
      id: "b",
      status: "draft",
      amendsContractId: "a",
      createdAt: "2026-09-10T00:00:00.000Z",
    });
    // Full catalog vs draft/sent-only (Wave 1 query) — tip draft still counts once.
    const full = countVenueActionRequiredContracts(rollupContractsToCurrentAgreements([v1, v2]));
    const slim = countVenueActionRequiredContracts(rollupContractsToCurrentAgreements([v2]));
    assert.equal(full, 1);
    assert.equal(slim, 1);

    const awaitingVenue = contract({
      id: "avs",
      status: "sent",
      venueSigned: false,
      requiredClientTotal: 1,
      requiredClientSigned: 1,
    });
    const sentToClient = contract({
      id: "stc",
      status: "sent",
      venueSigned: false,
      requiredClientTotal: 1,
      requiredClientSigned: 0,
    });
    assert.equal(
      countVenueActionRequiredContracts(
        rollupContractsToCurrentAgreements([awaitingVenue, sentToClient]),
      ),
      1,
    );
  });
});

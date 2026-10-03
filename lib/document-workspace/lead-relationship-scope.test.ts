/**
 * Lead Documents relationship scope — get_venue_documents(p_lead_id).
 *
 * Source-contract tests for the repair migration. Live Sandbox proofs the UI.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const repair = readFileSync(
  join(root, "supabase/migrations/20261408200000_lead_documents_relationship_scope.sql"),
  "utf8",
);
const service = readFileSync(join(root, "lib/document-workspace/service.ts"), "utf8");
const leadPage = readFileSync(join(root, "app/(app)/leads/[id]/page.tsx"), "utf8");
const prior = readFileSync(
  join(root, "supabase/migrations/20261407300000_client_choices_foundation.sql"),
  "utf8",
);

describe("Lead Documents relationship scope — get_venue_documents", () => {
  it("resolves the linked Client only via venue-scoped clients.lead_id", () => {
    assert.match(repair, /v_rel_client_id/);
    assert.match(repair, /from public\.clients c/);
    assert.match(repair, /c\.lead_id = p_lead_id/);
    assert.match(repair, /c\.venue_id = v_venue_id/);
    assert.doesNotMatch(repair, /join public\.clients[^\n]+on[^\n]+(email|phone)/i);
    assert.doesNotMatch(repair, /where[^\n]*(email|phone)\s*=/i);
  });

  it("10. does NOT rely on p_lead_id AND p_client_id intersection for lead scope", () => {
    // Lead page passes leadId alone — must not require a second RPC arg.
    assert.match(leadPage, /getVenueWorkspaceDocuments\(\{\s*leadId:\s*id\s*\}\)/);
    assert.doesNotMatch(leadPage, /getVenueWorkspaceDocuments\(\{[^}]*clientId/);
    // Service still maps scope fields 1:1; repair expands inside SQL when lead is set.
    assert.match(service, /p_lead_id:\s*scope\.leadId \?\? null/);
    // Lead branch must not keep the old hard exclude.
    assert.doesNotMatch(
      repair,
      /from public\.contracts c[\s\S]*?p_lead_id is null and p_vendor_id is null/,
    );
    assert.doesNotMatch(
      repair,
      /from public\.invoices i[\s\S]*?p_lead_id is null and p_vendor_id is null/,
    );
  });

  it("1. Lead without Client — only lead-owned generic docs; no phantom contract/invoice", () => {
    assert.match(
      repair,
      /when p_lead_id is not null then \(\s*d\.lead_id = p_lead_id/,
    );
    // Contracts/invoices require v_rel_client_id — null when no linked Client.
    assert.match(
      repair,
      /when p_lead_id is not null then\s+v_rel_client_id is not null and c\.client_id = v_rel_client_id/,
    );
    assert.match(
      repair,
      /when p_lead_id is not null then\s+v_rel_client_id is not null and i\.client_id = v_rel_client_id/,
    );
  });

  it("2. Lead + linked Client — client contracts and invoices included without lead-owned file", () => {
    assert.match(repair, /v_rel_client_id is not null and c\.client_id = v_rel_client_id/);
    assert.match(repair, /v_rel_client_id is not null and i\.client_id = v_rel_client_id/);
  });

  it("3. Lead + linked Client + Event — event producers via linked Client events", () => {
    assert.match(repair, /from public\.floor_plans fp/);
    assert.match(repair, /from public\.event_questionnaires q/);
    assert.match(repair, /from public\.event_orders eo/);
    assert.match(repair, /e\.client_id = v_rel_client_id/);
    assert.match(repair, /distinct on \(doc->>'docType', doc->>'id'\)/);
  });

  it("4/5. Converted leftovers discoverable; unrelated Client isolation via clients.lead_id only", () => {
    // Moved-to-client/event generic docs are included through relationship client/event paths.
    assert.match(repair, /d\.client_id = v_rel_client_id/);
    assert.match(repair, /e\.client_id = v_rel_client_id/);
    // No soft identity join that could pull another Client.
    assert.doesNotMatch(repair, /join public\.clients[^\n]+on[^\n]+email/i);
    assert.doesNotMatch(repair, /i\.client_id\s*=\s*p_lead_id/);
  });

  it("6. Global Documents (all-null) still unions producers when p_lead_id is null", () => {
    // Non-lead branches keep prior client/event null-tolerant filters.
    assert.match(
      repair,
      /when p_lead_id is not null then[\s\S]+else\s+\(p_client_id is null or c\.client_id = p_client_id\)/,
    );
    assert.match(
      repair,
      /when p_lead_id is not null then[\s\S]+else\s+\(p_client_id is null or i\.client_id = p_client_id\)/,
    );
  });

  it("7. Vendor Documents — vendor filter preserved; commercial producers stay vendor-null", () => {
    assert.match(repair, /p_vendor_id is null or d\.vendor_id = p_vendor_id/);
    assert.match(repair, /and p_vendor_id is null\s+and \(\s*case\s+when p_lead_id is not null then\s+v_rel_client_id is not null and c\.client_id/);
  });

  it("8. Client/Event Documents — non-lead path keeps prior client_id / event_id filters", () => {
    // Booking scope (both ids) is a dedicated branch; legacy else keeps AND filters.
    assert.match(repair, /p_client_id is null or c\.client_id = p_client_id/);
    assert.match(repair, /p_event_id\s+is null or c\.event_id\s+= p_event_id/);
    assert.match(repair, /p_client_id is null or e\.client_id = p_client_id/);
    assert.match(repair, /p_event_id\s+is null or eo\.event_id = p_event_id/);
  });

  it("9. Empty relationship — no Client means no contract/invoice producers", () => {
    assert.match(repair, /v_rel_client_id is not null and c\.client_id = v_rel_client_id/);
    assert.match(repair, /select c\.id\s+into v_rel_client_id/);
  });

  it("prior migration still documented the exclude; repair replaces the function", () => {
    assert.match(prior, /p_lead_id is null and p_vendor_id is null/);
    assert.match(repair, /create or replace function public\.get_venue_documents/);
    assert.match(repair, /Relationship Workspace|relationship scope/i);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import test from "node:test";

import {
  buildVenueExportZip,
  collectExportFiles,
  redactExportValue,
  venueOwnsStoragePath,
} from "@/lib/export/archive";

const VENUE = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

test("redaction removes secrets nested in rows", () => {
  const cleaned = redactExportValue({
    contracts: [{ id: "c1", title: "Agreement", sign_token: "secret" }],
    venues: { name: "Hall", stripe_account_id: "acct_1", embed_key: "embed", tour_embed_key: "tour" },
    quickbooks_connections: [{ company_name: "Books", access_token: "oa", refresh_token: "re" }],
    client_invitations: [{ email: "a@b.c", token: "invite" }],
    messages: [{ body: "hello", luv_draft_id: "draft" }],
  }) as Record<string, unknown>;

  const contract = (cleaned.contracts as Array<Record<string, unknown>>)[0];
  assert.equal(contract.title, "Agreement");
  assert.equal("sign_token" in contract, false);
  const venue = cleaned.venues as Record<string, unknown>;
  assert.equal(venue.name, "Hall");
  assert.equal("stripe_account_id" in venue, false);
  assert.equal("embed_key" in venue, false);
  assert.equal("tour_embed_key" in venue, false);
  const qb = (cleaned.quickbooks_connections as Array<Record<string, unknown>>)[0];
  assert.equal(qb.company_name, "Books");
  assert.equal("access_token" in qb, false);
  assert.equal("refresh_token" in qb, false);
  const invite = (cleaned.client_invitations as Array<Record<string, unknown>>)[0];
  assert.equal("token" in invite, false);
  const message = (cleaned.messages as Array<Record<string, unknown>>)[0];
  assert.equal(message.body, "hello");
  assert.equal("luv_draft_id" in message, false);
});

test("file collection keeps this venue's paths and drops other venues", () => {
  const files = collectExportFiles({
    documents: [
      { storage_path: `${VENUE}/clients/a.pdf`, file_name: "a.pdf" },
      { storage_path: `${OTHER}/clients/b.pdf`, file_name: "b.pdf" },
    ],
    canonical_document_representations: [
      { storage_path: `${VENUE}/contract/final.pdf`, representation_type: "pdf" },
      { storage_path: `conversations/${OTHER}/note.pdf`, representation_type: "pdf" },
    ],
    floor_plans: [{
      background_image_url: `https://example.supabase.co/storage/v1/object/public/floor-plans/${VENUE}/floor_plan/bg.png`,
    }],
  }, VENUE);

  assert.deepEqual(files.map((file) => `${file.bucket ?? "resolve"}:${file.path}`), [
    `documents:${VENUE}/clients/a.pdf`,
    `floor-plans:${VENUE}/floor_plan/bg.png`,
    `resolve:${VENUE}/contract/final.pdf`,
  ]);
  assert.equal(venueOwnsStoragePath(VENUE, `${OTHER}/file`), false);
});

test("zip contains collections, manifest omissions, and only owned files", () => {
  const zip = buildVenueExportZip({
    venueId: VENUE,
    exportedAt: "2026-10-17T00:00:00.000Z",
    collections: {
      clients: [{ id: "client-1", name: "Ada" }],
      contracts: [{ id: "c1", sign_token: "nope" }],
      couple_websites: [{ title: "should not be passed by the rpc" }],
    },
    fileBytes: [
      {
        file: { bucket: "documents", path: `${VENUE}/a.pdf`, fileName: "a.pdf" },
        bytes: new Uint8Array([1, 2, 3]),
      },
      {
        file: { bucket: "documents", path: `${OTHER}/b.pdf`, fileName: "b.pdf" },
        bytes: new Uint8Array([9]),
      },
    ],
  });
  const entries = unzipSync(zip);
  const clients = JSON.parse(new TextDecoder().decode(entries["data/clients.json"]));
  assert.equal(clients[0].name, "Ada");
  const contracts = JSON.parse(new TextDecoder().decode(entries["data/contracts.json"]));
  assert.equal("sign_token" in contracts[0], false);
  const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
  assert.equal(manifest.venueId, VENUE);
  assert.equal(manifest.counts.clients, 1);
  assert.equal(manifest.files.length, 1);
  assert.equal(manifest.files[0].path, `${VENUE}/a.pdf`);
  assert.equal(entries[`files/documents/${OTHER}/b.pdf`], undefined);
  assert.ok(entries[`files/documents/${VENUE}/a.pdf`]);
  const omitted = manifest.omitted.map((item: { name: string }) => item.name);
  assert.ok(omitted.includes("Wedding websites"));
  assert.ok(omitted.includes("Luv"));
  assert.ok(omitted.includes("Couple planning data"));
});

test("migration does not query excluded domains and enforces export access", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261419200000_venue_data_export_v1.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /s\.is_owner is true/);
  assert.match(sql, /basis = 'administrator'/);
  assert.match(sql, /data\.export/);
  assert.match(sql, /current_user_venue_id\(\)/);
  assert.match(sql, /venue_export_redact/);
  assert.match(sql, /coalesce\(\s*\(coalesce\(s\.capability_overrides/);
  for (const excluded of [
    "couple_websites",
    "couple_guests",
    "couple_budgets",
    "luv_recommendations",
    "luv_drafts",
    "htc_crm_",
    "questionnaire_submissions",
    "rsvp_answers",
    "stripe_webhook_events",
  ]) {
    assert.equal(sql.includes(excluded), false, excluded);
  }
  assert.match(sql, /'invoice_line_items'/);
  assert.match(sql, /'documents'/);
  assert.match(sql, /'leads'/);
  assert.match(sql, /'messages'/);
});

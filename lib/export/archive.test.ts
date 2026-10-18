import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import test from "node:test";

import {
  buildVenueExportZip,
  collectExportFiles,
  redactExportValue,
  shapeExportCollections,
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

test("vendor directory export is limited to this venue's relationships", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261419300000_venue_export_vendor_scope.sql", import.meta.url),
    "utf8",
  );
  assert.equal(sql.includes("('vendors', 'venue_id')"), false);
  assert.match(sql, /from public\.vendors v/);
  assert.match(sql, /from public\.venue_vendor_relationships r/);
  assert.match(sql, /where r\.venue_id = \$1/);
  assert.match(sql, /claim_token/);
  assert.match(sql, /luv_intro_seen_at/);
});

test("export columns are an explicit allowlist that omits secret fields", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261419400000_venue_export_column_allowlist.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /venue_export_project\(p_row jsonb, p_columns text\[\]\)/);
  assert.equal(sql.includes("jsonb_agg(to_jsonb("), false);
  assert.match(sql, /A column added to a table later is omitted/);
  const lists = [
    ...sql.matchAll(/\('([a-z0-9_]+)', '(?:venue_id|id)', '([^']+)'\)/g),
    ...sql.matchAll(/string_to_array\('([^']+)'/g),
  ].map((match) => (match[2] ?? match[1]).split(","));
  const columns = new Set(lists.flat());
  for (const secret of [
    "embed_key",
    "tour_embed_key",
    "stripe_account_id",
    "saas_stripe_customer_id",
    "stripe_customer_id",
    "sign_token",
    "claim_token",
    "access_token",
    "refresh_token",
    "invite_token",
    "token",
    "luv_draft_id",
    "luv_intro_seen_at",
  ]) {
    assert.equal(columns.has(secret), false, secret);
  }
  assert.equal(lists.some((list) => list.includes("storage_path")), true);
  assert.match(sql, /'message_events', 'venue_id', 'event_type,id,message_id,occurred_at,venue_id'/);
});

test("nested export values keep business fields and drop secret-key variants", () => {
  const cleaned = redactExportValue({
    notes: [{ body: "Bring the linen order", nested: [{ Sign_Token: "nope", label: "Linen" }] }],
    settings: { primaryColor: "#112233", accessToken: "nope", "embed-key": "nope" },
  }) as {
    notes: Array<{ body: string; nested: Array<Record<string, unknown>> }>;
    settings: Record<string, unknown>;
  };
  assert.equal(cleaned.notes[0].body, "Bring the linen order");
  assert.equal(cleaned.notes[0].nested[0].label, "Linen");
  assert.equal("Sign_Token" in cleaned.notes[0].nested[0], false);
  assert.equal(cleaned.settings.primaryColor, "#112233");
  assert.equal("accessToken" in cleaned.settings, false);
  assert.equal("embed-key" in cleaned.settings, false);
});

test("known json shapes keep business fields and drop extra keys", () => {
  const shaped = shapeExportCollections({
    contracts: [{
      title: "Agreement",
      branding_snapshot: { name: "Hall", primaryColor: "#111111", embed_key: "nope" },
    }],
    invoices: [{
      invoice_number: "100",
      branding_snapshot: { businessName: "Hall", city: "Portland", refresh_token: "nope" },
    }],
    conversation_messages: [{
      body: "Hello",
      channel_metadata: { sequenceEnrollmentId: "enr", sourceType: "sequence", access_token: "nope" },
    }],
    event_order_share_snapshots: [{
      payload: { sections: [{ name: "Dinner" }], lines: [], total: 10, sign_token: "nope" },
    }],
    venue_operational_info: [{ faqs: [{ question: "Parking?", answer: "Lot B" }] }],
  });
  const contract = (shaped.contracts as Array<{ branding_snapshot: Record<string, unknown> }>)[0];
  assert.equal(contract.branding_snapshot.name, "Hall");
  assert.equal(contract.branding_snapshot.primaryColor, "#111111");
  assert.equal("embed_key" in contract.branding_snapshot, false);
  const invoice = (shaped.invoices as Array<{ branding_snapshot: Record<string, unknown> }>)[0];
  assert.equal(invoice.branding_snapshot.city, "Portland");
  assert.equal("refresh_token" in invoice.branding_snapshot, false);
  const message = (shaped.conversation_messages as Array<{ body: string; channel_metadata: Record<string, unknown> }>)[0];
  assert.equal(message.body, "Hello");
  assert.equal(message.channel_metadata.sequenceEnrollmentId, "enr");
  assert.equal("access_token" in message.channel_metadata, false);
  const snapshot = (shaped.event_order_share_snapshots as Array<{ payload: Record<string, unknown> }>)[0];
  assert.deepEqual(snapshot.payload.sections, [{ name: "Dinner" }]);
  assert.equal(snapshot.payload.total, 10);
  assert.equal("sign_token" in snapshot.payload, false);
  const info = (shaped.venue_operational_info as Array<{ faqs: unknown }>)[0];
  assert.deepEqual(info.faqs, [{ question: "Parking?", answer: "Lot B" }]);
});

test("venue export omits the lead email routing key without changing intake", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261419500000_venue_export_hardening.sql", import.meta.url),
    "utf8",
  );
  const venues = sql.match(/\('venues', 'id', '([^']+)'\)/);
  assert.ok(venues);
  assert.equal(venues[1].split(",").includes("lead_email_key"), false);
  assert.equal(venues[1].split(",").includes("email"), true);
  assert.match(sql, /language sql/);
  assert.match(sql, /jsonb_object_agg/);
  assert.equal(sql.includes("out := out || jsonb_build_object"), false);
  const intake = readFileSync(new URL("../../lib/venue/repository.ts", import.meta.url), "utf8");
  assert.match(intake, /lead_email_key/);
});

test("overlapping export timeout is raised only for the export function", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261419600000_venue_export_statement_timeout.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /alter function public\.get_venue_export\(uuid\) set statement_timeout = '30s'/);
  assert.equal(sql.includes("alter role"), false);
});

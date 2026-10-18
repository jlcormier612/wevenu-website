import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import test from "node:test";

import {
  buildVenueExportZip,
  collectExportFiles,
  csvCell,
  documentExportBucket,
  recordsToCsv,
  redactExportValue,
  shapeExportCollections,
  venueExportBaseName,
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
      {
        storage_path: `conversations/${VENUE}/thread/note.png`,
        file_name: "note.png",
      },
      {
        storage_path: `conversations/${OTHER}/thread/other.png`,
        file_name: "other.png",
      },
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
    `couple-messages:conversations/${VENUE}/thread/note.png`,
    `floor-plans:${VENUE}/floor_plan/bg.png`,
    `resolve:${VENUE}/contract/final.pdf`,
  ]);
  assert.equal(venueOwnsStoragePath(VENUE, `${OTHER}/file`), false);
  assert.equal(documentExportBucket(`${VENUE}/clients/a.pdf`), "documents");
  assert.equal(documentExportBucket(`conversations/${VENUE}/thread/note.png`), "couple-messages");
  assert.equal(files.some((file) => file.path.includes(OTHER)), false);
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
        file: {
          bucket: "documents",
          path: `${VENUE}/a.pdf`,
          fileName: "a.pdf",
          recordId: "doc-1",
          proposedName: "Other/a.pdf",
        },
        bytes: new Uint8Array([1, 2, 3]),
      },
      {
        file: {
          bucket: "documents",
          path: `${OTHER}/b.pdf`,
          fileName: "b.pdf",
          recordId: "doc-2",
          proposedName: "Other/b.pdf",
        },
        bytes: new Uint8Array([9]),
      },
    ],
  });
  const entries = unzipSync(zip);
  const clientsPath = Object.keys(entries).find((name) => name.endsWith("/Technical-Backup/clients.json"));
  const contractsPath = Object.keys(entries).find((name) => name.endsWith("/Technical-Backup/contracts.json"));
  const manifestPath = Object.keys(entries).find((name) => name.endsWith("/manifest.json"));
  assert.ok(clientsPath);
  assert.ok(contractsPath);
  assert.ok(manifestPath);
  const clients = JSON.parse(new TextDecoder().decode(entries[clientsPath]));
  assert.equal(clients[0].name, "Ada");
  const contracts = JSON.parse(new TextDecoder().decode(entries[contractsPath]));
  assert.equal("sign_token" in contracts[0], false);
  const manifest = JSON.parse(new TextDecoder().decode(entries[manifestPath]));
  assert.equal(manifest.venueId, VENUE);
  assert.equal(manifest.counts.clients, 1);
  assert.equal(manifest.files.length, 1);
  assert.equal(manifest.files[0].path, `${VENUE}/a.pdf`);
  assert.equal(Object.keys(entries).some((name) => name.includes(OTHER)), false);
  assert.ok(Object.keys(entries).some((name) => name.endsWith("/Documents-and-Uploads/Other/a.pdf")));
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
    conversations: [{
      inquiry_context: { eventType: "Wedding", coupleName: "Ada", access_token: "nope" },
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
  const conversation = (shaped.conversations as Array<{ inquiry_context: Record<string, unknown> }>)[0];
  assert.equal(conversation.inquiry_context.eventType, "Wedding");
  assert.equal(conversation.inquiry_context.coupleName, "Ada");
  assert.equal("access_token" in conversation.inquiry_context, false);
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

test("conversation inquiry context exports only the product fields", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261419700000_venue_export_inquiry_context.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /'inquiry_context', array\['eventId','eventDate','eventType','venueName','coupleName'\]/);
  assert.match(sql, /alter function public\.get_venue_export\(uuid\) set statement_timeout = '30s'/);
});

test("csv keeps commas, quotes, newlines, unicode, and neutralizes formula cells", () => {
  const csv = recordsToCsv([{
    id: "lead-1",
    name: "Ada, \"Bee\"",
    notes: "line one\nline two",
    city: "São Paulo",
    formula: "=1+1",
    plus: "+cmd",
    minus: "-1",
    at: "@sum",
    empty: null,
  }], ["id", "name", "notes", "city", "formula", "plus", "minus", "at", "empty"]);
  assert.match(csv, /"Ada, ""Bee"""/);
  assert.match(csv, /"line one\nline two"/);
  assert.match(csv, /São Paulo/);
  assert.match(csv, /'=1\+1/);
  assert.equal(csvCell("+cmd"), "'+cmd");
  assert.equal(csvCell("-1"), "'-1");
  assert.equal(csvCell("@sum"), "'@sum");
  assert.equal(csvCell(null), "");
});

test("spreadsheet views keep the complete json backup and contract text", () => {
  const zip = buildVenueExportZip({
    venueId: VENUE,
    exportedAt: "2026-10-18T15:00:00.000Z",
    collections: {
      venues: { id: VENUE, name: "Sweet Daisy Barn & Farm", email: "venue@example.com", stripe_account_id: "acct" },
      leads: [{
        id: "lead-1",
        first_name: "Ada",
        notes: "Bring, the \"cake\"\nplease",
        source_data: { platform: "ig" },
        sign_token: "tok-should-not-appear",
      }],
      contracts: [{
        id: "contract-1",
        title: "Agreement",
        status: "signed",
        client_id: "client-1",
        content: { clauses: ["The couple keeps the full agreement text."] },
        branding_snapshot: { name: "Hall", primaryColor: "#111111", embed_key: "nope" },
      }],
    },
  });
  const entries = unzipSync(zip);
  const root = "Hello-to-Cheers-Export-Sweet-Daisy-Barn-Farm-2026-10-18";
  const leadJson = JSON.parse(new TextDecoder().decode(entries[`${root}/Technical-Backup/leads.json`]));
  const leadCsv = new TextDecoder().decode(entries[`${root}/Leads-and-Clients/leads.csv`]);
  assert.equal(leadJson[0].notes, "Bring, the \"cake\"\nplease");
  assert.deepEqual(leadJson[0].source_data, { platform: "ig" });
  assert.equal("sign_token" in leadJson[0], false);
  assert.match(leadCsv, /Bring, the ""cake""/);
  assert.equal(leadCsv.includes("tok-should-not-appear"), false);
  const contractJson = JSON.parse(new TextDecoder().decode(entries[`${root}/Technical-Backup/contracts.json`]));
  const contractCsv = new TextDecoder().decode(entries[`${root}/Contracts-and-Finances/contracts.csv`]);
  assert.deepEqual(contractJson[0].content, { clauses: ["The couple keeps the full agreement text."] });
  assert.equal(contractJson[0].branding_snapshot.name, "Hall");
  assert.equal("embed_key" in contractJson[0].branding_snapshot, false);
  assert.equal(contractCsv.includes("full agreement text"), false);
  assert.match(contractCsv, /Agreement/);
  const readme = new TextDecoder().decode(entries[`${root}/START-HERE.txt`]);
  assert.match(readme, /Leads-and-Clients\/leads.csv/);
  assert.match(readme, /Contracts-and-Finances\/contracts.csv/);
  assert.equal(readme.includes("tok-should-not-appear"), false);
  assert.equal(readme.includes("Luv recommendations"), true);
  const manifest = JSON.parse(new TextDecoder().decode(entries[`${root}/manifest.json`]));
  assert.equal(manifest.venueId, VENUE);
  assert.equal(manifest.counts.leads, 1);
  assert.equal(manifest.counts.contracts, 1);
  assert.ok(manifest.entries.some((entry: { path: string }) => entry.path === "Technical-Backup/contracts.json"));
  assert.equal(JSON.stringify(manifest).includes("tok-should-not-appear"), false);
  assert.equal(venueExportBaseName("Sweet Daisy Barn & Farm", "2026-10-18T15:00:00.000Z"), root);
});

test("duplicate upload names and conversation files stay venue-scoped", () => {
  const files = collectExportFiles({
    documents: [
      { id: "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", storage_path: `conversations/${VENUE}/thread/note.png`, file_name: "note.png", category: "other" },
    ],
    message_attachments: [
      { id: "22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb", storage_path: `${VENUE}/mail/note.png`, name: "note.png" },
      { id: "33333333-cccc-cccc-cccc-cccccccccccc", storage_path: `${VENUE}/mail/note-2.png`, name: "note.png" },
      { id: "44444444-dddd-dddd-dddd-dddddddddddd", storage_path: `${OTHER}/mail/note.png`, name: "note.png" },
    ],
  }, VENUE);
  assert.equal(files[0]?.bucket, "couple-messages");
  const zip = buildVenueExportZip({
    venueId: VENUE,
    exportedAt: "2026-10-18T00:00:00.000Z",
    venueName: "Fancy",
    collections: { venues: { name: "Fancy" } },
    fileBytes: files.map((file) => ({ file, bytes: new Uint8Array([1]) })),
  });
  const names = Object.keys(unzipSync(zip)).filter((name) => name.includes("Documents-and-Uploads"));
  assert.equal(names.length, 3);
  assert.equal(new Set(names).size, 3);
  assert.ok(names.some((name) => name.endsWith("/Documents-and-Uploads/Message-attachments/note.png")));
  assert.ok(names.some((name) => name.includes("cccccccc")));
  assert.equal(names.some((name) => name.includes(OTHER)), false);
});

test("unreadable files and export limits still fail closed", () => {
  const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
  assert.match(service, /Could not read venue file/);
  assert.match(service, /status: 500, message: "A venue file could not be read. The export was not completed."/);
  assert.match(service, /const MAX_FILES = 400/);
  assert.match(service, /const MAX_BYTES = 60 \* 1024 \* 1024/);
  assert.match(service, /if \(files.length > MAX_FILES\)/);
  assert.match(service, /if \(total > MAX_BYTES\)/);
  assert.match(service, /if \(bytes.byteLength > MAX_BYTES\)/);
  assert.match(service, /canExportVenueData/);
  const download = service.slice(service.indexOf("async function downloadOwned"), service.indexOf("export async function buildVenueExportArchive"));
  assert.match(download, /throw new Error/);
  const archive = service.slice(service.indexOf("const bytes = buildVenueExportZip"));
  assert.ok(archive.indexOf("buildVenueExportZip") < archive.indexOf("return { ok: true"));
});

test("overlapping export timeout is raised only for the export function", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261419600000_venue_export_statement_timeout.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /alter function public\.get_venue_export\(uuid\) set statement_timeout = '30s'/);
  assert.equal(sql.includes("alter role"), false);
});

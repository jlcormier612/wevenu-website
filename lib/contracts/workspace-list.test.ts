/**
 * Performance Slice 3A — Client Workspace contract / template list scoping.
 *
 * Proves: client|event OR filter, content omitted, signers only for scoped IDs,
 * readiness fields intact, template metadata without content, detail path keeps *.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { computeContractsReadiness } from "@/lib/readiness/compute";
import type { Contract } from "@/lib/contracts/types";
import {
  getContractsForClientOrEvent,
  getTemplatesMetadata,
  getTemplate,
  getTemplates,
} from "@/lib/contracts/repository";

const repoSrc = readFileSync(resolve("lib/contracts/repository.ts"), "utf8");
const serviceSrc = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
const pageSrc = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const bookingDocsSrc = readFileSync(resolve("components/events/booking-documents-tab.tsx"), "utf8");
const newContractPage = readFileSync(resolve("app/(app)/contracts/new/page.tsx"), "utf8");
const editTemplatePage = readFileSync(resolve("app/(app)/contracts/templates/[id]/edit/page.tsx"), "utf8");
const journeyLoad = readFileSync(resolve("lib/booking-journey/load.ts"), "utf8");

type Call = { table: string; method: string; args: unknown[] };

function makeClient(opts: {
  contractRows?: Record<string, unknown>[];
  signerRows?: Record<string, unknown>[];
  templateRows?: Record<string, unknown>[];
  templateById?: Record<string, unknown> | null;
}) {
  const calls: Call[] = [];
  const contractRows = opts.contractRows ?? [];
  const signerRows = opts.signerRows ?? [];
  const templateRows = opts.templateRows ?? [];

  function chain(table: string, terminal: () => Promise<{ data: unknown; error: null }>) {
    const api: Record<string, (...a: unknown[]) => unknown> = {};
    const wrap = (method: string) => (...args: unknown[]) => {
      calls.push({ table, method, args });
      return api;
    };
    api.select = wrap("select");
    api.eq = wrap("eq");
    api.or = wrap("or");
    api.in = wrap("in");
    api.order = wrap("order");
    api.neq = wrap("neq");
    api.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return { data: opts.templateById ?? null, error: null };
    };
    // Thenable so `await q.order(...)` resolves
    api.then = (...a: unknown[]) => {
      const resolve = a[0] as (v: unknown) => unknown;
      const reject = a[1] as ((e: unknown) => unknown) | undefined;
      return terminal().then(resolve, reject);
    };
    return api;
  }

  const client = {
    calls,
    from(table: string) {
      if (table === "contracts") {
        return chain(table, async () => ({ data: contractRows, error: null }));
      }
      if (table === "contract_signers") {
        return chain(table, async () => ({ data: signerRows, error: null }));
      }
      if (table === "contract_templates") {
        return chain(table, async () => ({ data: templateRows, error: null }));
      }
      return chain(table, async () => ({ data: [], error: null }));
    },
  };
  return client;
}

function baseContractRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "c-client",
    venue_id: "v1",
    client_id: "client-a",
    event_id: "event-a",
    template_id: null,
    title: "Client Agreement",
    status: "sent",
    execution_origin: "htc",
    sign_token: "tok",
    signer_name: null,
    signed_at: null,
    sent_at: "2026-09-01T00:00:00.000Z",
    expires_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    amends_contract_id: null,
    branding_snapshot: null,
    ...overrides,
  };
}

describe("Slice 3A — repository workspace contract list", () => {
  it("returns client-linked contracts and event-only contracts; excludes unrelated", async () => {
    const clientLinked = baseContractRow({ id: "c-client", client_id: "client-a", event_id: null });
    const eventOnly = baseContractRow({
      id: "c-event",
      client_id: null,
      event_id: "event-a",
      title: "Event-only Agreement",
    });
    // Fake DB already "filtered"; assert OR filter was issued with both ids.
    const sb = makeClient({
      contractRows: [clientLinked, eventOnly],
      signerRows: [
        { contract_id: "c-client", signer_type: "client", signed_at: null, is_required: true },
        { contract_id: "c-event", signer_type: "venue", signed_at: "2026-09-02T00:00:00.000Z", is_required: true },
      ],
    });

    const rows = await getContractsForClientOrEvent(sb as never, "v1", {
      clientId: "client-a",
      eventId: "event-a",
    });

    const orCall = sb.calls.find((c) => c.method === "or");
    assert.ok(orCall, "must use .or(client|event)");
    assert.equal(orCall.args[0], "client_id.eq.client-a,event_id.eq.event-a");
    assert.ok(sb.calls.some((c) => c.table === "contracts" && c.method === "eq" && c.args[0] === "venue_id"));

    assert.deepEqual(
      rows.map((r) => r.id).sort(),
      ["c-client", "c-event"],
    );
    assert.equal(rows.find((r) => r.id === "c-client")?.clientId, "client-a");
    assert.equal(rows.find((r) => r.id === "c-event")?.eventId, "event-a");
    assert.equal(rows.find((r) => r.id === "c-event")?.clientId, null);
  });

  it("does not select or return contract content on the workspace list query", async () => {
    const sb = makeClient({
      contractRows: [baseContractRow()],
      signerRows: [],
    });
    const rows = await getContractsForClientOrEvent(sb as never, "v1", {
      clientId: "client-a",
      eventId: "event-a",
    });
    const selectCall = sb.calls.find((c) => c.table === "contracts" && c.method === "select");
    assert.ok(selectCall);
    const selectArg = String(selectCall.args[0]);
    assert.doesNotMatch(selectArg, /\bcontent\b/);
    assert.doesNotMatch(selectArg, /^\*$/);
    assert.equal(rows[0]?.content, "");
  });

  it("retrieves signers only for the scoped contract IDs", async () => {
    const sb = makeClient({
      contractRows: [
        baseContractRow({ id: "c1" }),
        baseContractRow({ id: "c2", client_id: null, event_id: "event-a" }),
      ],
      signerRows: [
        { contract_id: "c1", signer_type: "client", signed_at: null, is_required: true },
        { contract_id: "c2", signer_type: "client", signed_at: "2026-09-03T00:00:00.000Z", is_required: true },
      ],
    });
    const rows = await getContractsForClientOrEvent(sb as never, "v1", {
      clientId: "client-a",
      eventId: "event-a",
    });
    const inCall = sb.calls.find((c) => c.table === "contract_signers" && c.method === "in");
    assert.ok(inCall);
    assert.equal(inCall.args[0], "contract_id");
    assert.deepEqual((inCall.args[1] as string[]).sort(), ["c1", "c2"]);
    assert.equal(rows.find((r) => r.id === "c1")?.requiredClientSigned, 0);
    assert.equal(rows.find((r) => r.id === "c2")?.requiredClientSigned, 1);
    assert.equal(rows.find((r) => r.id === "c2")?.anyClientSigned, true);
  });

  it("supplies readiness fields status + executionOrigin without content", () => {
    const contracts: Contract[] = [
      {
        id: "c1",
        venueId: "v1",
        clientId: "client-a",
        eventId: "event-a",
        templateId: null,
        title: "A",
        content: "",
        status: "sent",
        executionOrigin: "htc",
        signToken: "t",
        signerName: null,
        signedAt: null,
        sentAt: "2026-09-01T00:00:00.000Z",
        expiresAt: null,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        amendsContractId: null,
        brandingSnapshot: null,
        clientName: null,
        clientEmail: null,
        eventDate: null,
      },
    ];
    const section = computeContractsReadiness(contracts);
    assert.equal(section.status, "waiting");
    assert.match(section.detail, /Sent/);
  });
});

describe("Slice 3A — template metadata vs detail content", () => {
  it("metadata list omits content and still returns workspace name fields", async () => {
    const sb = makeClient({
      templateRows: [
        {
          id: "tmpl-1",
          venue_id: "v1",
          name: "Wedding Agreement",
          description: "Standard",
          is_default: true,
          is_archived: false,
          source_master_key: "CTR-01",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const rows = await getTemplatesMetadata(sb as never, "v1");
    const selectCall = sb.calls.find((c) => c.table === "contract_templates" && c.method === "select");
    assert.ok(selectCall);
    assert.doesNotMatch(String(selectCall.args[0]), /\bcontent\b/);
    assert.equal(rows[0]?.name, "Wedding Agreement");
    assert.equal(rows[0]?.isDefault, true);
    assert.equal(rows[0]?.content, "");
  });

  it("getTemplate(id) still selects full row including content", async () => {
    const sb = makeClient({
      templateById: {
        id: "tmpl-1",
        venue_id: "v1",
        name: "Wedding Agreement",
        description: null,
        content: "FULL {{client_name}} BODY",
        is_default: true,
        is_archived: false,
        source_master_key: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    });
    const t = await getTemplate(sb as never, "v1", "tmpl-1");
    const selectCall = sb.calls.find((c) => c.table === "contract_templates" && c.method === "select");
    assert.equal(selectCall?.args[0], "*");
    assert.equal(t?.content, "FULL {{client_name}} BODY");
  });

  it("getTemplates() (create path) still selects * with content", async () => {
    const sb = makeClient({
      templateRows: [
        {
          id: "tmpl-1",
          venue_id: "v1",
          name: "Wedding Agreement",
          description: null,
          content: "BODY",
          is_default: true,
          is_archived: false,
          source_master_key: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const rows = await getTemplates(sb as never, "v1");
    const selectCall = sb.calls.find((c) => c.table === "contract_templates" && c.method === "select");
    assert.equal(selectCall?.args[0], "*");
    assert.equal(rows[0]?.content, "BODY");
  });

  it("new-contract and edit-template pages still load content-bearing templates", () => {
    assert.match(newContractPage, /getTemplates\(\)/);
    assert.doesNotMatch(newContractPage, /getTemplatesMetadata/);
    assert.match(editTemplatePage, /getTemplate\(id\)/);
  });

  it("Documents tab only consumes template names (metadata-safe)", () => {
    assert.match(bookingDocsSrc, /contractTemplates\.map\(\(t\) => t\.name\)/);
    assert.doesNotMatch(bookingDocsSrc, /t\.content|template\.content/);
  });
});

describe("Slice 3A — wiring + venue isolation", () => {
  it("Client Workspace uses scoped contracts + metadata templates", () => {
    assert.match(pageSrc, /getContractsForClientOrEvent\(id, eventId\)/);
    assert.match(pageSrc, /getTemplatesMetadata as getContractTemplates/);
    assert.doesNotMatch(pageSrc, /getContracts\(\)/);
    assert.doesNotMatch(pageSrc, /contractsFilteredPromise/);
    assert.doesNotMatch(pageSrc, /all\.filter\(\(c\) => c\.eventId === eventId \|\| c\.clientId === id\)/);
  });

  it("booking journey on CW (with eventId) reuses the same scoped fetch", () => {
    assert.match(journeyLoad, /getContractsForClientOrEvent\(input\.clientId, input\.eventId\)/);
  });

  it("service wrappers preserve getCurrentVenue (RLS/auth boundary)", () => {
    const scoped = serviceSrc.slice(
      serviceSrc.indexOf("export async function getContractsForClientOrEvent"),
      serviceSrc.indexOf("export async function getContractsForWorkflowList"),
    );
    assert.match(scoped, /getCurrentVenue/);
    assert.match(scoped, /venue\.id/);
    assert.match(scoped, /repo\.getContractsForClientOrEvent/);

    const meta = serviceSrc.slice(
      serviceSrc.indexOf("export async function getTemplatesMetadata"),
      serviceSrc.indexOf("export async function getTemplate("),
    );
    assert.match(meta, /getCurrentVenue/);
    assert.match(meta, /repo\.getTemplatesMetadata/);
  });

  it("venue-wide getContracts remains for Financials / other callers", () => {
    assert.match(serviceSrc, /export async function getContracts\(\)/);
    assert.match(repoSrc, /select\("\*, clients\(/);
  });
});

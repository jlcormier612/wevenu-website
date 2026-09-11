import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildContractVersionFamily,
  deriveVersionNumber,
  formatVersionLabel,
  isContractContentLocked,
  statusLabelForVersion,
  type ContractLineageNode,
} from "@/lib/contracts/version-lineage";
import { applyContractVersionLineage, normalizeWorkspaceDocument } from "@/lib/document-workspace/normalize";
import {
  canCreateNewVersionFromContract,
  projectCloneDraftFromSource,
} from "@/lib/contracts/signature-blocks";

describe("contract version lineage (amends_contract_id)", () => {
  const nodes: ContractLineageNode[] = [
    {
      id: "a",
      title: "Agreement",
      status: "signed",
      amendsContractId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      signedAt: "2026-01-02T00:00:00.000Z",
      finalized: true,
    },
    {
      id: "b",
      title: "Agreement",
      status: "draft",
      amendsContractId: "a",
      createdAt: "2026-02-01T00:00:00.000Z",
      signedAt: null,
      finalized: false,
    },
    {
      id: "c",
      title: "Agreement",
      status: "signed",
      amendsContractId: "b",
      createdAt: "2026-03-01T00:00:00.000Z",
      signedAt: "2026-03-05T00:00:00.000Z",
      finalized: true,
    },
  ];

  it("derives Version 1 / 2 / 3 from the parent chain", () => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    assert.equal(deriveVersionNumber("a", byId), 1);
    assert.equal(deriveVersionNumber("b", byId), 2);
    assert.equal(deriveVersionNumber("c", byId), 3);
  });

  it("builds a family with current and based-on relationships", () => {
    const family = buildContractVersionFamily("b", nodes);
    assert.equal(family.length, 3);
    assert.equal(family[0].versionNumber, 1);
    assert.equal(family[0].id, "a");
    assert.equal(family[0].finalized, true);
    assert.equal(family[1].versionNumber, 2);
    assert.equal(family[1].current, true);
    assert.equal(family[1].amendsContractId, "a");
    assert.equal(family[2].versionNumber, 3);
  });

  it("formats human labels", () => {
    assert.equal(formatVersionLabel(2), "Version 2");
    assert.equal(statusLabelForVersion({ status: "draft", finalized: false, locked: false }), "Draft");
    assert.equal(statusLabelForVersion({ status: "draft", finalized: false, locked: true }), "Ready to send");
    assert.equal(statusLabelForVersion({ status: "signed", finalized: true, locked: true }), "Signed · Final");
  });

  it("treats venue-signed content as locked", () => {
    assert.equal(isContractContentLocked({ status: "draft", venueSigned: true }), true);
    assert.equal(isContractContentLocked({ status: "draft", venueSigned: false }), false);
    assert.equal(isContractContentLocked({ status: "signed", venueSigned: false }), true);
  });
});

describe("Create New Version product path", () => {
  it("allows creation after venue signature / signed; blocks external and unlocked drafts", () => {
    assert.equal(
      canCreateNewVersionFromContract({
        venueSigned: true,
        status: "sent",
        anyClientSigned: false,
      }).ok,
      true,
    );
    assert.equal(
      canCreateNewVersionFromContract({
        venueSigned: false,
        status: "signed",
        anyClientSigned: false,
      }).ok,
      true,
    );
    assert.equal(
      canCreateNewVersionFromContract({
        venueSigned: false,
        status: "draft",
        anyClientSigned: false,
      }).ok,
      false,
    );
    assert.equal(
      canCreateNewVersionFromContract({
        venueSigned: true,
        status: "signed",
        anyClientSigned: true,
        executionOrigin: "external",
      }).ok,
      false,
    );
  });

  it("projects a fresh draft without copying evidence; original unchanged", () => {
    const source = {
      id: "v1",
      status: "signed",
      title: "Venue Agreement",
      content: "Terms locked",
      clientId: "client-1",
      eventId: "event-1",
      templateId: "tmpl",
      executionOrigin: "htc",
      finalizedAt: "2026-01-10T00:00:00.000Z",
      sentAt: "2026-01-01T00:00:00.000Z",
      signers: [
        {
          id: "sv",
          signerType: "venue" as const,
          isRequired: true,
          signedAt: "2026-01-01T00:00:00.000Z",
          signToken: "tok-v",
          contentHash: "h-v",
          consentText: "yes",
          signerIp: "1.1.1.1",
        },
        {
          id: "sc",
          signerType: "client" as const,
          isRequired: true,
          signedAt: "2026-01-02T00:00:00.000Z",
          signToken: "tok-c",
          contentHash: "h-c",
          consentText: "yes",
          signerIp: "2.2.2.2",
        },
      ],
    };
    const before = structuredClone(source);
    const { originalUnchanged, clone } = projectCloneDraftFromSource(source);
    assert.deepEqual(originalUnchanged, before);
    assert.equal(clone.status, "draft");
    assert.equal(clone.amendsContractId, "v1");
    assert.equal(clone.content, "Terms locked");
    assert.equal(clone.finalizedAt, null);
    assert.ok(clone.signers.every((s) => s.signedAt === null));
    assert.ok(clone.signers.every((s) => s.inheritsEvidence === false));
    assert.ok(clone.signers.every((s) => s.inheritsToken === false));
  });
});

describe("Documents workspace contract lineage presentation", () => {
  it("does not invent Version 2 from timestamps for non-lineage docs", () => {
    const doc = normalizeWorkspaceDocument({
      docType: "invoice",
      id: "inv-1",
      name: "Invoice 1",
      category: "invoice",
      status: "paid",
      currentVersion: 1,
      ownerType: "client",
      leadId: null,
      clientId: "c1",
      eventId: null,
      vendorId: null,
      relationshipName: "A & B",
      eventName: null,
      fileUrl: null,
      fileSize: null,
      mimeType: null,
      isCoupleVisible: true,
      isVendorVisible: false,
      uploadedByType: "venue",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    assert.equal(doc.currentVersion, 1);
    assert.equal(doc.versionFamily, undefined);
  });

  it("marks companion contract uploads distinctly", () => {
    const doc = normalizeWorkspaceDocument({
      docType: "document",
      id: "doc-1",
      name: "Signed scan",
      category: "contract",
      status: null,
      currentVersion: 1,
      ownerType: "event",
      leadId: null,
      clientId: "c1",
      eventId: "e1",
      vendorId: null,
      relationshipName: "A & B",
      eventName: "Wedding",
      fileUrl: "https://example.com/x.pdf",
      fileSize: 100,
      mimeType: "application/pdf",
      isCoupleVisible: true,
      isVendorVisible: false,
      uploadedByType: "venue",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(doc.isCompanionUpload, true);
    assert.match(doc.name, /uploaded file/i);
  });

  it("applies real Version 1 / Version 2 from amends lineage", () => {
    const docs = [
      normalizeWorkspaceDocument({
        docType: "contract",
        id: "a",
        name: "Agreement",
        category: "contract",
        status: "signed",
        currentVersion: 1,
        ownerType: "client",
        leadId: null,
        clientId: "c1",
        eventId: "e1",
        vendorId: null,
        relationshipName: "A & B",
        eventName: "Wedding",
        fileUrl: null,
        fileSize: null,
        mimeType: null,
        isCoupleVisible: true,
        isVendorVisible: false,
        uploadedByType: "venue",
        signedAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      normalizeWorkspaceDocument({
        docType: "contract",
        id: "b",
        name: "Agreement",
        category: "contract",
        status: "draft",
        currentVersion: 1,
        ownerType: "client",
        leadId: null,
        clientId: "c1",
        eventId: "e1",
        vendorId: null,
        relationshipName: "A & B",
        eventName: "Wedding",
        fileUrl: null,
        fileSize: null,
        mimeType: null,
        isCoupleVisible: false,
        isVendorVisible: false,
        uploadedByType: "venue",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      }),
    ];
    const enriched = applyContractVersionLineage(docs, [
      {
        id: "a",
        title: "Agreement",
        status: "signed",
        amendsContractId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        signedAt: "2026-01-02T00:00:00.000Z",
        finalized: true,
      },
      {
        id: "b",
        title: "Agreement",
        status: "draft",
        amendsContractId: "a",
        createdAt: "2026-02-01T00:00:00.000Z",
        signedAt: null,
        finalized: false,
      },
    ]);
    const v1 = enriched.find((d) => d.id === "a")!;
    const v2 = enriched.find((d) => d.id === "b")!;
    assert.equal(v1.currentVersion, 1);
    assert.equal(v2.currentVersion, 2);
    assert.equal(v2.amendsContractId, "a");
    assert.equal(v2.versionFamily?.length, 2);
    assert.match(v2.name, /Version 2/);
  });
});

describe("Create New Version service wiring", () => {
  it("exposes createNewVersionFromContract and does not copy signatures in clone engine", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const root = path.resolve(__dirname, "../..");
    const svc = fs.readFileSync(path.join(root, "lib/contracts/service.ts"), "utf8");
    assert.match(svc, /export async function createNewVersionFromContract/);
    assert.match(svc, /return cloneAndResendContract/);
    const clone = svc.slice(svc.indexOf("export async function cloneAndResendContract"));
    assert.match(clone, /amendsContractId: sourceContractId/);
    assert.match(clone, /New version of/);
    assert.doesNotMatch(clone.slice(0, 1200), /signedAt:/);
  });

  it("detail UI offers Create New Version; does not expose Clone & Resend or Create Amendment", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const root = path.resolve(__dirname, "../..");
    const detail = fs.readFileSync(path.join(root, "components/contracts/contract-detail.tsx"), "utf8");
    assert.match(detail, /Create New Version/);
    assert.match(detail, /createNewVersionFromContractAction/);
    assert.match(detail, /canCreateNewVersion/);
    assert.doesNotMatch(detail, /Clone &amp; Resend|Clone & Resend/);
    assert.doesNotMatch(detail, /Create Amendment/);
    assert.match(detail, /const canReopen = false/);
    assert.match(detail, /Version history/);
  });

  it("actions expose createNewVersionFromContractAction", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const root = path.resolve(__dirname, "../..");
    const actions = fs.readFileSync(path.join(root, "app/(app)/contracts/actions.ts"), "utf8");
    assert.match(actions, /createNewVersionFromContractAction/);
    assert.match(actions, /createNewVersionFromContract/);
  });

  it("resend remains same-contract and is distinct from createNewVersion", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const root = path.resolve(__dirname, "../..");
    const svc = fs.readFileSync(path.join(root, "lib/contracts/service.ts"), "utf8");
    const resend = svc.slice(svc.indexOf("export async function resendContract"));
    const end = resend.indexOf("\nexport async function", 1);
    const body = end > 0 ? resend.slice(0, end) : resend.slice(0, 1200);
    assert.match(body, /status !== "sent"/);
    assert.doesNotMatch(body, /insertContract\(/);
    assert.doesNotMatch(body, /amendsContractId/);
  });
});

/**
 * Unit tests for Legal Acceptance Engine (WP2).
 *
 * Repeat-acceptance policy: when the user is already current on the active
 * version, `recordAcceptance` returns `{ status: "already_accepted" }` and
 * does **not** insert another audit row (gate-idempotent). New versions or
 * never-accepted types still insert via the append-only repository path.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  createLegalAcceptanceService,
  type LegalAcceptanceEngineDeps,
  type LegalAcceptanceUser,
} from "./acceptance-engine";
import {
  clearLegalEventListeners,
  type LegalDomainEvent,
} from "./events";
import {
  REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE,
  type LegalAcceptanceUserType,
} from "./required-documents";
import type {
  LegalAcceptance,
  LegalAcceptanceMethod,
  LegalDocument,
} from "./types";

type Store = {
  documents: Map<string, LegalDocument>;
  acceptances: LegalAcceptance[];
  nextAcceptanceId: number;
};

function makeDoc(
  partial: Partial<LegalDocument> &
    Pick<LegalDocument, "id" | "documentType" | "version">,
): LegalDocument {
  return {
    title: partial.title ?? partial.documentType,
    effectiveDate: partial.effectiveDate ?? "2026-01-01",
    content: partial.content ?? "body",
    isPublished: partial.isPublished ?? true,
    isActive: partial.isActive ?? true,
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function createMemoryDeps(store: Store): LegalAcceptanceEngineDeps {
  return {
    async getActiveDocumentByType(documentType) {
      for (const doc of store.documents.values()) {
        if (doc.documentType === documentType && doc.isActive) return doc;
      }
      return null;
    },
    async getDocumentById(id) {
      return store.documents.get(id) ?? null;
    },
    async getLatestAcceptanceForDocumentType(input) {
      const userId = input.userId?.trim() || null;
      const relationshipId = input.relationshipId?.trim() || null;
      if (!userId && !relationshipId) return null;

      const typeDocIds = new Set(
        [...store.documents.values()]
          .filter((d) => d.documentType === input.documentType)
          .map((d) => d.id),
      );

      const matches = store.acceptances.filter((a) => {
        if (!typeDocIds.has(a.legalDocumentId)) return false;
        if (userId && relationshipId) {
          return a.userId === userId || a.relationshipId === relationshipId;
        }
        if (userId) return a.userId === userId;
        return a.relationshipId === relationshipId;
      });

      matches.sort(
        (a, b) =>
          new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime(),
      );
      return matches[0] ?? null;
    },
    async insertAcceptance(input) {
      const row: LegalAcceptance = {
        id: `acc-${store.nextAcceptanceId++}`,
        relationshipId: input.relationshipId ?? null,
        userId: input.userId,
        legalDocumentId: input.legalDocumentId,
        acceptedVersion: input.acceptedVersion,
        acceptedAt: input.acceptedAt ?? new Date().toISOString(),
        acceptanceMethod: input.acceptanceMethod,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        createdAt: new Date().toISOString(),
      };
      store.acceptances.unshift(row);
      return row;
    },
  };
}

function seedRequiredActiveDocs(
  store: Store,
  userType: LegalAcceptanceUserType,
  version = "1.0",
): LegalDocument[] {
  const docs: LegalDocument[] = [];
  for (const documentType of REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE[userType]) {
    const doc = makeDoc({
      id: `doc-${documentType}-${version}`,
      documentType,
      version,
      isActive: true,
      isPublished: true,
    });
    store.documents.set(doc.id, doc);
    docs.push(doc);
  }
  return docs;
}

describe("LegalAcceptanceService", () => {
  let store: Store;
  let events: LegalDomainEvent[];

  beforeEach(() => {
    store = {
      documents: new Map(),
      acceptances: [],
      nextAcceptanceId: 1,
    };
    events = [];
    clearLegalEventListeners();
  });

  afterEach(() => {
    clearLegalEventListeners();
  });

  function service() {
    return createLegalAcceptanceService({
      ...createMemoryDeps(store),
      publishEvent: (e) => {
        events.push(e);
      },
    });
  }

  function coupleUser(): LegalAcceptanceUser {
    return { userId: "user-1", userType: "couple" };
  }

  it("maps required documents by user type", () => {
    const svc = service();
    assert.deepEqual(svc.getRequiredDocuments("venue_owner"), [
      "terms_of_service",
      "privacy_policy",
      "cookie_policy",
      "acceptable_use_policy",
    ]);
    assert.deepEqual(svc.getRequiredDocuments("venue_manager"), [
      "privacy_policy",
      "acceptable_use_policy",
    ]);
    assert.deepEqual(svc.getRequiredDocuments("team_member"), [
      "privacy_policy",
      "acceptable_use_policy",
    ]);
    assert.deepEqual(svc.getRequiredDocuments("couple"), [
      "couple_end_user_terms",
      "privacy_policy",
    ]);
    assert.deepEqual(svc.getRequiredDocuments("vendor"), [
      "vendor_end_user_terms",
      "privacy_policy",
    ]);
  });

  it("requires acceptance until all required docs are accepted (first acceptance)", async () => {
    const docs = seedRequiredActiveDocs(store, "couple");
    const svc = service();
    const user = coupleUser();

    const before = await svc.requiresAcceptance(user);
    assert.equal(before.requiresAcceptance, true);
    assert.equal(before.outstanding.length, 2);

    const first = await svc.recordAcceptance(user, docs[0]!, {
      acceptanceMethod: "Couple Invitation" satisfies LegalAcceptanceMethod,
      ipAddress: "1.2.3.4",
      userAgent: "node:test",
    });
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.status, "recorded");

    const mid = await svc.getOutstandingDocuments(user);
    assert.equal(mid.length, 1);
    assert.equal(mid[0]?.documentType, "privacy_policy");

    const second = await svc.recordAcceptance(user, docs[1]!, {
      acceptanceMethod: "Couple Invitation",
    });
    assert.equal(second.ok, true);

    const after = await svc.requiresAcceptance(user);
    assert.equal(after.requiresAcceptance, false);
    assert.deepEqual(after.outstanding, []);

    assert.ok(events.some((e) => e.type === "LegalDocumentAccepted"));
    assert.ok(events.some((e) => e.type === "LegalRequirementsSatisfied"));
  });

  it("treats repeat acceptance of a current version as already_accepted (no new row)", async () => {
    const docs = seedRequiredActiveDocs(store, "couple");
    const svc = service();
    const user = coupleUser();

    for (const doc of docs) {
      const result = await svc.recordAcceptance(user, doc, {
        acceptanceMethod: "Couple Invitation",
      });
      assert.ok(result.ok && result.status === "recorded");
    }

    const rowsBefore = store.acceptances.length;
    const repeat = await svc.recordAcceptance(user, docs[0]!, {
      acceptanceMethod: "Couple Invitation",
    });

    assert.equal(repeat.ok, true);
    if (repeat.ok) {
      assert.equal(repeat.status, "already_accepted");
    }
    assert.equal(store.acceptances.length, rowsBefore);

    const gate = await svc.requiresAcceptance(user);
    assert.equal(gate.requiresAcceptance, false);
    assert.deepEqual(gate.outstanding, []);
  });

  it("marks user outstanding again when a required document gets a new active version", async () => {
    const docs = seedRequiredActiveDocs(store, "vendor", "1.0");
    const svc = service();
    const user: LegalAcceptanceUser = {
      userId: "vendor-1",
      userType: "vendor",
    };

    for (const doc of docs) {
      await svc.recordAcceptance(user, doc, {
        acceptanceMethod: "Vendor Invitation",
      });
    }
    assert.equal((await svc.requiresAcceptance(user)).requiresAcceptance, false);

    const oldPrivacy = docs.find((d) => d.documentType === "privacy_policy")!;
    store.documents.set(oldPrivacy.id, { ...oldPrivacy, isActive: false });
    const newPrivacy = makeDoc({
      id: "doc-privacy_policy-2.0",
      documentType: "privacy_policy",
      version: "2.0",
      isActive: true,
      isPublished: true,
    });
    store.documents.set(newPrivacy.id, newPrivacy);

    const outstanding = await svc.getOutstandingDocuments(user);
    assert.equal(outstanding.length, 1);
    assert.equal(outstanding[0]?.documentType, "privacy_policy");
    assert.equal(outstanding[0]?.active?.version, "2.0");
    assert.equal((await svc.requiresAcceptance(user)).requiresAcceptance, true);

    const reAccept = await svc.recordAcceptance(user, newPrivacy, {
      acceptanceMethod: "Version Update",
    });
    assert.ok(reAccept.ok && reAccept.status === "recorded");
    assert.equal((await svc.requiresAcceptance(user)).requiresAcceptance, false);
  });

  it("handles multiple required documents for venue owner", async () => {
    const docs = seedRequiredActiveDocs(store, "venue_owner");
    const svc = service();
    const user: LegalAcceptanceUser = {
      userId: "owner-1",
      userType: "venue_owner",
    };

    assert.equal(docs.length, 4);
    assert.deepEqual(
      (await svc.getActiveDocuments("venue_owner")).map((d) => d.documentType),
      REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE.venue_owner,
    );

    const outstanding = await svc.getOutstandingDocuments(user);
    assert.deepEqual(
      outstanding.map((o) => o.documentType),
      [
        "terms_of_service",
        "privacy_policy",
        "cookie_policy",
        "acceptable_use_policy",
      ],
    );

    for (const doc of docs) {
      await svc.recordAcceptance(user, doc, {
        acceptanceMethod: "Venue Signup",
      });
    }

    const accepted = await svc.getAcceptedDocuments(user);
    assert.ok(accepted.every((a) => a.isCurrent));
    assert.equal((await svc.requiresAcceptance(user)).requiresAcceptance, false);
  });

  it("uses different required sets for different user types", async () => {
    seedRequiredActiveDocs(store, "venue_manager");
    seedRequiredActiveDocs(store, "couple");
    const svc = service();

    const managerOutstanding = await svc.getOutstandingDocuments({
      userId: "m1",
      userType: "venue_manager",
    });
    const coupleOutstanding = await svc.getOutstandingDocuments({
      userId: "c1",
      userType: "couple",
    });

    assert.deepEqual(
      managerOutstanding.map((o) => o.documentType),
      ["privacy_policy", "acceptable_use_policy"],
    );
    assert.deepEqual(
      coupleOutstanding.map((o) => o.documentType),
      ["couple_end_user_terms", "privacy_policy"],
    );
  });

  it("rejects acceptance of inactive documents", async () => {
    const inactive = makeDoc({
      id: "doc-inactive",
      documentType: "privacy_policy",
      version: "1.0",
      isActive: false,
      isPublished: true,
    });
    store.documents.set(inactive.id, inactive);

    const svc = service();
    const result = await svc.recordAcceptance(
      { userId: "user-1", userType: "couple" },
      inactive,
      { acceptanceMethod: "Couple Invitation" },
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "document_inactive");
    }
    assert.equal(store.acceptances.length, 0);
  });

  it("rejects unpublished active documents", async () => {
    const unpublished = makeDoc({
      id: "doc-unpub",
      documentType: "privacy_policy",
      version: "1.0",
      isActive: true,
      isPublished: false,
    });
    store.documents.set(unpublished.id, unpublished);

    const svc = service();
    const result = await svc.recordAcceptance(
      { userId: "user-1", userType: "couple" },
      unpublished,
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "document_unpublished");
    }
  });

  it("rejects empty user id", async () => {
    const docs = seedRequiredActiveDocs(store, "couple");
    const svc = service();
    const result = await svc.recordAcceptance(
      { userId: "  ", userType: "couple" },
      docs[0]!,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "invalid_user");
  });

  it("resolves document by id when only id is provided", async () => {
    const docs = seedRequiredActiveDocs(store, "couple");
    const svc = service();
    const result = await svc.recordAcceptance(
      { userId: "user-1", userType: "couple" },
      { id: docs[0]!.id },
      { acceptanceMethod: "Couple Invitation" },
    );
    assert.ok(result.ok && result.status === "recorded");
  });
});

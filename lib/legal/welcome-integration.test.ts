import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLegalAcceptanceService,
  type LegalAcceptanceUser,
  type OutstandingDocument,
} from "./acceptance-engine";
import type { LegalDocument } from "./types";
import {
  acceptanceMethodForContext,
  buildWelcomeRedirectPath,
  copyForWelcomeContext,
  inferWelcomeContext,
  mapStaffRoleToLegalUserType,
  outstandingImpliesPriorAcceptance,
  recordOutstandingAcceptances,
  reviewableOutstanding,
  safeReturnToPath,
  welcomeRequiresReview,
  WP4_WELCOME_COPY,
} from "./welcome-integration";
import {
  evaluateLegalMiddleware,
  isPublicLegalPath,
  shouldSkipLegalEnforcement,
} from "./welcome-middleware";

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
    publishedBy: partial.publishedBy ?? null,
    publishedAt: partial.publishedAt ?? null,
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("welcome-integration role + context mapping", () => {
  it("maps venue org roles to engine user types", () => {
    assert.equal(mapStaffRoleToLegalUserType("owner"), "venue_owner");
    assert.equal(mapStaffRoleToLegalUserType("manager"), "venue_manager");
    assert.equal(mapStaffRoleToLegalUserType("staff"), "team_member");
    assert.equal(mapStaffRoleToLegalUserType("coordinator"), "team_member");
    assert.equal(mapStaffRoleToLegalUserType(null), "venue_owner");
  });

  it("infers venue signup for first-time owners on /setup", () => {
    assert.equal(
      inferWelcomeContext({
        userType: "venue_owner",
        pathname: "/setup",
        hasPriorAcceptance: false,
      }),
      "venueSignup",
    );
  });

  it("infers venue signup for first-time owners on Setup Hub", () => {
    assert.equal(
      inferWelcomeContext({
        userType: "venue_owner",
        pathname: "/setup-hub",
        hasPriorAcceptance: false,
      }),
      "venueSignup",
    );
  });

  it("infers couple / vendor invitation on first visit", () => {
    assert.equal(
      inferWelcomeContext({
        userType: "couple",
        hasPriorAcceptance: false,
      }),
      "coupleInvitation",
    );
    assert.equal(
      inferWelcomeContext({
        userType: "vendor",
        hasPriorAcceptance: false,
      }),
      "vendorInvitation",
    );
  });

  it("uses version update when a prior acceptance exists", () => {
    assert.equal(
      inferWelcomeContext({
        userType: "venue_owner",
        pathname: "/setup",
        hasPriorAcceptance: true,
      }),
      "versionUpdate",
    );
    assert.equal(
      inferWelcomeContext({
        userType: "vendor",
        pathname: "/vendor/dashboard",
        hasPriorAcceptance: true,
      }),
      "versionUpdate",
    );
  });

  it("maps contexts to acceptance methods", () => {
    assert.equal(acceptanceMethodForContext("venueSignup"), "Venue Signup");
    assert.equal(
      acceptanceMethodForContext("coupleInvitation"),
      "Couple Invitation",
    );
    assert.equal(
      acceptanceMethodForContext("vendorInvitation"),
      "Vendor Invitation",
    );
    assert.equal(acceptanceMethodForContext("versionUpdate"), "Version Update");
  });

  it("exposes WP4 copy for venue signup and version update", () => {
    assert.equal(
      copyForWelcomeContext("venueSignup").heading,
      WP4_WELCOME_COPY.venueSignup.heading,
    );
    assert.match(
      String(copyForWelcomeContext("venueSignup").introduction),
      /Before creating your venue workspace/,
    );
    assert.equal(
      copyForWelcomeContext("versionUpdate").heading,
      "We've updated a few things.",
    );
  });

  it("detects prior acceptance from outstanding snapshots", () => {
    assert.equal(
      outstandingImpliesPriorAcceptance([
        {
          documentType: "privacy_policy",
          active: null,
          acceptance: null,
        },
      ]),
      false,
    );
    assert.equal(
      outstandingImpliesPriorAcceptance([
        {
          documentType: "privacy_policy",
          active: null,
          acceptance: {
            id: "a1",
            userId: "u1",
            relationshipId: null,
            legalDocumentId: "d1",
            acceptedVersion: "1.0",
            acceptanceMethod: "Venue Signup",
            acceptedAt: "2026-01-01T00:00:00.000Z",
            ipAddress: null,
            userAgent: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      ]),
      true,
    );
  });

  it("only treats reviewable (active) outstanding as Welcome-blocking", () => {
    assert.equal(
      welcomeRequiresReview([
        { documentType: "privacy_policy", active: null, acceptance: null },
        {
          documentType: "couple_end_user_terms",
          active: null,
          acceptance: null,
        },
      ]),
      false,
    );
    assert.equal(
      reviewableOutstanding([
        { documentType: "privacy_policy", active: null, acceptance: null },
      ]).length,
      0,
    );
    const active = makeDoc({
      id: "priv",
      documentType: "privacy_policy",
      version: "1.0",
    });
    assert.equal(
      welcomeRequiresReview([
        { documentType: "privacy_policy", active, acceptance: null },
      ]),
      true,
    );
  });
});

describe("returnTo preservation", () => {
  it("keeps exact relative destinations", () => {
    assert.equal(
      safeReturnToPath("/events/abc?tab=timeline#notes"),
      "/events/abc?tab=timeline#notes",
    );
  });

  it("rejects external and protocol-relative URLs", () => {
    assert.equal(safeReturnToPath("https://evil.example/phish"), "/dashboard");
    assert.equal(safeReturnToPath("//evil.example/phish"), "/dashboard");
  });

  it("never returns to /welcome itself", () => {
    assert.equal(safeReturnToPath("/welcome?returnTo=/x"), "/dashboard");
  });

  it("builds welcome URLs that preserve returnTo", () => {
    const path = buildWelcomeRedirectPath({
      returnTo: "/clients/9?view=notes",
      context: "versionUpdate",
    });
    assert.equal(
      path,
      "/welcome?returnTo=%2Fclients%2F9%3Fview%3Dnotes&context=versionUpdate",
    );
    const params = new URLSearchParams(path.split("?")[1]);
    assert.equal(params.get("returnTo"), "/clients/9?view=notes");
  });
});

describe("legal middleware decisions", () => {
  it("allows compliant users without redirect", () => {
    const decision = evaluateLegalMiddleware({
      pathname: "/dashboard",
      search: "",
      requiresAcceptance: false,
      context: "versionUpdate",
    });
    assert.deepEqual(decision, { action: "allow" });
  });

  it("skips already-compliant enforcement when disabled", () => {
    assert.deepEqual(
      evaluateLegalMiddleware({
        pathname: "/dashboard",
        search: "",
        requiresAcceptance: true,
        context: "versionUpdate",
        enabled: false,
      }),
      { action: "allow" },
    );
  });

  it("redirects page navigations to welcome with returnTo", () => {
    const decision = evaluateLegalMiddleware({
      pathname: "/events/42",
      search: "?tab=timeline",
      requiresAcceptance: true,
      context: "versionUpdate",
    });
    assert.equal(decision.action, "redirect_welcome");
    if (decision.action !== "redirect_welcome") return;
    assert.equal(decision.returnTo, "/events/42?tab=timeline");
    assert.match(decision.welcomePath, /^\/welcome\?/);
    assert.match(
      decision.welcomePath,
      /returnTo=%2Fevents%2F42%3Ftab%3Dtimeline/,
    );
    assert.match(decision.welcomePath, /context=versionUpdate/);
  });

  it("uses venueSignup context path for new venue setup resumes", () => {
    const decision = evaluateLegalMiddleware({
      pathname: "/setup",
      search: "",
      requiresAcceptance: true,
      context: "venueSignup",
    });
    assert.equal(decision.action, "redirect_welcome");
    if (decision.action !== "redirect_welcome") return;
    assert.match(decision.welcomePath, /context=venueSignup/);
    assert.equal(decision.returnTo, "/setup");
  });

  it("preserves Setup Hub as returnTo for first-time venue owners", () => {
    const decision = evaluateLegalMiddleware({
      pathname: "/setup-hub",
      search: "",
      requiresAcceptance: true,
      context: "venueSignup",
    });
    assert.equal(decision.action, "redirect_welcome");
    if (decision.action !== "redirect_welcome") return;
    assert.equal(decision.returnTo, "/setup-hub");
    assert.match(decision.welcomePath, /context=venueSignup/);
  });

  it("does not redirect loop on welcome or public legal paths", () => {
    for (const pathname of [
      "/welcome",
      "/welcome/",
      "/terms",
      "/privacy",
      "/legal/privacy_policy",
      "/api/legal/welcome",
      "/vendor/accept",
      "/workspaces",
      "/p/abc",
    ]) {
      assert.equal(shouldSkipLegalEnforcement(pathname), true, pathname);
      assert.deepEqual(
        evaluateLegalMiddleware({
          pathname,
          search: "",
          requiresAcceptance: true,
          context: "versionUpdate",
        }),
        { action: "allow" },
      );
    }
    assert.equal(isPublicLegalPath("/cookies"), true);
  });

  it("blocks APIs with welcome resume info instead of HTML redirect", () => {
    const decision = evaluateLegalMiddleware({
      pathname: "/api/events",
      search: "",
      requiresAcceptance: true,
      context: "versionUpdate",
    });
    assert.equal(decision.action, "block_api");
    if (decision.action !== "block_api") return;
    assert.match(decision.welcomePath, /^\/welcome\?/);
  });

  it("skips enforcement for couple invitation portal tokens path", () => {
    assert.deepEqual(
      evaluateLegalMiddleware({
        pathname: "/p/tok123",
        search: "",
        requiresAcceptance: true,
        context: "coupleInvitation",
      }),
      { action: "allow" },
    );
  });
});

describe("recordOutstandingAcceptances integration", () => {
  it("records venue signup docs then reports already_accepted on repeat", async () => {
    const docs = [
      makeDoc({
        id: "tos",
        documentType: "terms_of_service",
        version: "1.0",
      }),
      makeDoc({
        id: "priv",
        documentType: "privacy_policy",
        version: "1.0",
      }),
    ];
    const acceptances: { legalDocumentId: string; userId: string }[] = [];
    const svc = createLegalAcceptanceService({
      getActiveDocumentByType: async (type) =>
        docs.find((d) => d.documentType === type && d.isActive) ?? null,
      getDocumentById: async (id) => docs.find((d) => d.id === id) ?? null,
      getLatestAcceptanceForDocumentType: async ({ userId, documentType }) => {
        const doc = docs.find((d) => d.documentType === documentType);
        if (!doc) return null;
        const row = acceptances.find(
          (a) => a.userId === userId && a.legalDocumentId === doc.id,
        );
        if (!row || !userId) return null;
        return {
          id: `acc-${doc.id}`,
          userId,
          relationshipId: null,
          legalDocumentId: doc.id,
          acceptedVersion: doc.version,
          acceptanceMethod: "Venue Signup" as const,
          acceptedAt: "2026-01-01T00:00:00.000Z",
          ipAddress: null,
          userAgent: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        };
      },
      insertAcceptance: async (input) => {
        acceptances.push({
          legalDocumentId: input.legalDocumentId,
          userId: input.userId,
        });
        return {
          id: `acc-${input.legalDocumentId}-${acceptances.length}`,
          userId: input.userId,
          relationshipId: input.relationshipId ?? null,
          legalDocumentId: input.legalDocumentId,
          acceptedVersion: input.acceptedVersion,
          acceptanceMethod: input.acceptanceMethod,
          acceptedAt: "2026-01-01T00:00:00.000Z",
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          createdAt: "2026-01-01T00:00:00.000Z",
        };
      },
      publishEvent: () => {},
    });

    const user: LegalAcceptanceUser = {
      userId: "owner-1",
      userType: "venue_owner",
    };
    const outstanding: OutstandingDocument[] = docs.map((active) => ({
      documentType: active.documentType,
      active,
      acceptance: null,
    }));

    const first = await recordOutstandingAcceptances({
      user,
      outstanding,
      acceptanceMethod: "Venue Signup",
      service: svc,
    });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.recorded, 2);
      assert.equal(first.alreadyAccepted, 0);
    }
    assert.equal(acceptances.length, 2);

    const second = await recordOutstandingAcceptances({
      user,
      outstanding,
      acceptanceMethod: "Venue Signup",
      service: svc,
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.recorded, 0);
      assert.equal(second.alreadyAccepted, 2);
    }
    assert.equal(acceptances.length, 2);
  });

  it("surfaces engine failures without recording partial success silently", async () => {
    const active = makeDoc({
      id: "priv",
      documentType: "privacy_policy",
      version: "1.0",
    });
    const svc = createLegalAcceptanceService({
      getActiveDocumentByType: async () => active,
      getDocumentById: async () => active,
      getLatestAcceptanceForDocumentType: async () => null,
      insertAcceptance: async () => {
        throw new Error("insert boom");
      },
      publishEvent: () => {},
    });

    const result = await recordOutstandingAcceptances({
      user: { userId: "u1", userType: "couple" },
      outstanding: [
        { documentType: "privacy_policy", active, acceptance: null },
      ],
      acceptanceMethod: "Couple Invitation",
      service: svc,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "insert_failed");
    }
  });

  it("treats outstanding-without-active as idempotent success", async () => {
    const svc = createLegalAcceptanceService({
      getActiveDocumentByType: async () => null,
      getDocumentById: async () => null,
      getLatestAcceptanceForDocumentType: async () => null,
      insertAcceptance: async () => {
        throw new Error("should not insert");
      },
      publishEvent: () => {},
    });
    const result = await recordOutstandingAcceptances({
      user: { userId: "u1", userType: "couple" },
      outstanding: [
        {
          documentType: "privacy_policy",
          active: null,
          acceptance: null,
        },
      ],
      acceptanceMethod: "Couple Invitation",
      service: svc,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.recorded, 0);
      assert.equal(result.alreadyAccepted, 0);
    }
  });
});

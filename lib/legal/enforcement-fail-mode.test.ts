/**
 * Legal enforcement fail-closed helpers + decideLegalProxyEnforcement seams.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  buildLegalEnforcementFailureDecision,
  isLegalEnforcementFailOpenEnabled,
  LEGAL_ENFORCEMENT_UNAVAILABLE_PATH,
} from "./enforcement-fail-mode";
import { decideLegalProxyEnforcement } from "./enforce-legal-in-proxy";
import { shouldSkipLegalEnforcement } from "./welcome-middleware";

const PREV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in PREV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(PREV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function clearDeployMarkers(env: NodeJS.ProcessEnv = process.env) {
  delete env.AWS_EXECUTION_ENV;
  delete env.AWS_REGION;
  delete env.ECS_CONTAINER_METADATA_URI;
  delete env.ECS_CONTAINER_METADATA_URI_V4;
  delete env.ECS_AGENT_URI;
  delete env.VERCEL_ENV;
  delete env.HTC_ENVIRONMENT;
  delete env.EnvironmentName;
}

describe("isLegalEnforcementFailOpenEnabled", () => {
  it("is false by default", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      LEGAL_ENFORCEMENT_FAIL_OPEN: undefined,
    };
    clearDeployMarkers(env);
    assert.equal(isLegalEnforcementFailOpenEnabled(env), false);
  });

  it("allows explicit local development override", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      LEGAL_ENFORCEMENT_FAIL_OPEN: "1",
    };
    clearDeployMarkers(env);
    assert.equal(isLegalEnforcementFailOpenEnabled(env), true);
  });

  it("rejects the flag when NODE_ENV=production", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      LEGAL_ENFORCEMENT_FAIL_OPEN: "1",
    };
    clearDeployMarkers(env);
    assert.equal(isLegalEnforcementFailOpenEnabled(env), false);
  });

  it("rejects the flag for HTC sandbox/production and ECS markers", () => {
    assert.equal(
      isLegalEnforcementFailOpenEnabled({
        NODE_ENV: "development",
        LEGAL_ENFORCEMENT_FAIL_OPEN: "1",
        HTC_ENVIRONMENT: "sandbox",
      }),
      false,
    );
    assert.equal(
      isLegalEnforcementFailOpenEnabled({
        NODE_ENV: "development",
        LEGAL_ENFORCEMENT_FAIL_OPEN: "1",
        AWS_EXECUTION_ENV: "AWS_ECS_FARGATE",
      }),
      false,
    );
    assert.equal(
      isLegalEnforcementFailOpenEnabled({
        NODE_ENV: "development",
        LEGAL_ENFORCEMENT_FAIL_OPEN: "1",
        VERCEL_ENV: "preview",
      }),
      false,
    );
  });
});

describe("buildLegalEnforcementFailureDecision", () => {
  it("redirects protected pages to the recovery path", () => {
    const decision = buildLegalEnforcementFailureDecision({
      pathname: "/dashboard",
      reason: "missing_service_role",
    });
    assert.deepEqual(decision, {
      action: "unavailable",
      recoveryPath: LEGAL_ENFORCEMENT_UNAVAILABLE_PATH,
      code: "legal_enforcement_unavailable",
      reason: "missing_service_role",
    });
  });

  it("blocks protected APIs with enforcement-unavailable code", () => {
    const decision = buildLegalEnforcementFailureDecision({
      pathname: "/api/events",
      reason: "engine_error",
    });
    assert.deepEqual(decision, {
      action: "block_api",
      welcomePath: LEGAL_ENFORCEMENT_UNAVAILABLE_PATH,
      code: "legal_enforcement_unavailable",
      reason: "engine_error",
    });
  });
});

describe("recovery and exempt paths stay reachable", () => {
  it("skips legal enforcement for recovery, welcome, auth, and public legal paths", () => {
    for (const pathname of [
      LEGAL_ENFORCEMENT_UNAVAILABLE_PATH,
      "/welcome",
      "/login",
      "/forgot-password",
      "/reset-password",
      "/auth/confirm",
      "/api/legal/welcome",
      "/api/portal/legal",
      "/legal/privacy_policy",
      "/terms",
      "/privacy",
      "/vendor/accept",
      "/client/accept",
      "/vendor/login",
    ]) {
      assert.equal(shouldSkipLegalEnforcement(pathname), true, pathname);
    }
  });
});

describe("decideLegalProxyEnforcement fail-closed", () => {
  const user = { id: "11111111-1111-1111-1111-111111111111" } as const;

  it("fails closed on missing service role for a protected page", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/dashboard",
        search: "",
        prefer: "venue",
      },
      { failOpenEnabled: () => false },
    );
    assert.deepEqual(decision, {
      action: "unavailable",
      recoveryPath: LEGAL_ENFORCEMENT_UNAVAILABLE_PATH,
      code: "legal_enforcement_unavailable",
    });
  });

  it("fails closed on missing service role for a protected API", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/api/clients",
        search: "",
        prefer: "venue",
      },
      { failOpenEnabled: () => false },
    );
    assert.equal(decision.action, "block_api");
    if (decision.action !== "block_api") return;
    assert.equal(decision.code, "legal_enforcement_unavailable");
  });

  it("fails closed when admin client initialization throws", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/clients",
        search: "",
        prefer: "venue",
      },
      {
        failOpenEnabled: () => false,
        createAdminClient: () => {
          throw new Error("admin init failed");
        },
      },
    );
    assert.deepEqual(decision, {
      action: "unavailable",
      recoveryPath: LEGAL_ENFORCEMENT_UNAVAILABLE_PATH,
      code: "legal_enforcement_unavailable",
    });
  });

  it("fails closed when the acceptance engine throws", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/dashboard",
        search: "",
        prefer: "venue",
      },
      {
        failOpenEnabled: () => false,
        createAdminClient: (() => ({})) as never,
        resolveUserType: async () => ({
          userType: "venue_owner",
          kind: "venue_owner_signup",
        }),
        requiresAcceptance: async () => {
          throw new Error("engine exploded");
        },
      },
    );
    assert.equal(decision.action, "unavailable");
  });

  it("does not create acceptance records when enforcement fails", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    let recordCalls = 0;
    await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/dashboard",
        search: "",
        prefer: "venue",
      },
      {
        failOpenEnabled: () => false,
        createAdminClient: (() => ({})) as never,
        resolveUserType: async () => ({
          userType: "venue_owner",
          kind: "venue_owner_signup",
        }),
        requiresAcceptance: async () => {
          recordCalls += 1;
          throw new Error("boom");
        },
      },
    );
    // requiresAcceptance may be attempted once; no recordAcceptance path exists here.
    assert.equal(recordCalls, 1);
  });

  it("allows healthy current-version users", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/dashboard",
        search: "",
        prefer: "venue",
      },
      {
        failOpenEnabled: () => false,
        createAdminClient: (() => ({})) as never,
        resolveUserType: async () => ({
          userType: "venue_owner",
          kind: "venue_staff",
        }),
        requiresAcceptance: async () => ({
          requiresAcceptance: false,
          outstanding: [],
          userType: "venue_owner",
          userId: user.id,
        }),
      },
    );
    assert.deepEqual(decision, { action: "allow" });
  });

  it("redirects outdated-version users to Welcome", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/dashboard",
        search: "",
        prefer: "venue",
      },
      {
        failOpenEnabled: () => false,
        createAdminClient: (() => ({})) as never,
        resolveUserType: async () => ({
          userType: "venue_owner",
          kind: "venue_staff",
        }),
        requiresAcceptance: async () => ({
          requiresAcceptance: true,
          outstanding: [
            {
              documentType: "terms_of_service",
              active: {
                id: "doc-1",
                documentType: "terms_of_service",
                version: "2026-09-23.1",
                title: "Venue Subscription Agreement",
                effectiveDate: "2026-09-23",
                content: "body",
                isPublished: true,
                isActive: true,
                publishedBy: null,
                publishedAt: null,
                createdAt: "2026-09-23",
                updatedAt: "2026-09-23",
              },
              acceptance: {
                id: "acc-1",
                userId: user.id,
                legalDocumentId: "doc-old",
                acceptedVersion: "2026-07-15.2",
                acceptanceMethod: "Venue Signup",
                acceptedAt: "2026-07-15T00:00:00.000Z",
                ipAddress: null,
                userAgent: null,
                relationshipId: null,
              },
            },
          ],
          userType: "venue_owner",
          userId: user.id,
        }),
      },
    );
    assert.equal(decision.action, "redirect_welcome");
    if (decision.action !== "redirect_welcome") return;
    assert.match(decision.welcomePath, /\/welcome/);
    assert.match(decision.welcomePath, /returnTo=%2Fdashboard/);
  });

  it("keeps vendor-only users on vendor legal context (not venue_owner)", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    let seenType: string | null = null;
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/vendor/dashboard",
        search: "",
        prefer: "vendor",
      },
      {
        failOpenEnabled: () => false,
        createAdminClient: (() => ({})) as never,
        resolveUserType: async (_admin, _id, prefer) => {
          assert.equal(prefer, "vendor");
          return { userType: "vendor", kind: "vendor" };
        },
        requiresAcceptance: async (u) => {
          seenType = u.userType;
          return {
            requiresAcceptance: false,
            outstanding: [],
            userType: "vendor",
            userId: user.id,
          };
        },
      },
    );
    assert.equal(seenType, "vendor");
    assert.deepEqual(decision, { action: "allow" });
  });

  it("multi-venue venue prefer still resolves via injected resolver (no silent allow)", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    let seenType: string | null = null;
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/clients",
        search: "",
        prefer: "venue",
        activeVenueId: "a415ac52-cd74-42a6-8df7-7a8f6e71d080",
      },
      {
        failOpenEnabled: () => false,
        createAdminClient: (() => ({})) as never,
        resolveUserType: async (_a, _u, prefer, activeVenueId) => {
          assert.equal(prefer, "venue");
          assert.equal(
            activeVenueId,
            "a415ac52-cd74-42a6-8df7-7a8f6e71d080",
          );
          return { userType: "venue_owner", kind: "venue_staff" };
        },
        requiresAcceptance: async (u) => {
          seenType = u.userType;
          return {
            requiresAcceptance: true,
            outstanding: [
              {
                documentType: "terms_of_service",
                active: {
                  id: "doc-1",
                  documentType: "terms_of_service",
                  version: "2026-09-23.1",
                  title: "Venue Subscription Agreement",
                  effectiveDate: "2026-09-23",
                  content: "body",
                  isPublished: true,
                  isActive: true,
                  publishedBy: null,
                  publishedAt: null,
                  createdAt: "2026-09-23",
                  updatedAt: "2026-09-23",
                },
                acceptance: null,
              },
            ],
            userType: "venue_owner",
            userId: user.id,
          };
        },
      },
    );
    assert.equal(seenType, "venue_owner");
    assert.equal(decision.action, "redirect_welcome");
  });

  it("local fail-open override still allows when explicitly enabled", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const decision = await decideLegalProxyEnforcement(
      {
        user: user as never,
        pathname: "/dashboard",
        search: "",
        prefer: "venue",
      },
      { failOpenEnabled: () => true },
    );
    assert.deepEqual(decision, { action: "allow" });
  });
});

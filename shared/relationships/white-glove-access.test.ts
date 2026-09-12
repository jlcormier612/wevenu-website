/**
 * White Glove CRM vs Product HQ access separation.
 * Uses an isolated file CRM store — no Supabase / Resend required.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { WHITE_GLOVE_CHECKLIST_MARKER, WHITE_GLOVE_CHECKLIST_TITLES } from "./white-glove-checklist.ts";
import type { Relationship, RelationshipTask } from "./types.ts";

const prevStore = process.env.HTC_CRM_STORE;
const prevPath = process.env.RELATIONSHIPS_DATA_PATH;
const prevProductUrl = process.env.NEXT_PUBLIC_PRODUCT_APP_URL;

let dataDir = "";

function baseRelationship(overrides: Partial<Relationship> = {}): Relationship {
  const now = new Date().toISOString();
  return {
    id: "rel_wg_test",
    venue: { name: "Test Venue", city: "Austin", state: "TX" },
    owner: {
      id: "c_owner",
      firstName: "Ada",
      lastName: "Owner",
      email: "ada@example.com",
    },
    status: "white_glove_implementation",
    health: "good",
    assignedTeamMemberId: "tm_eli",
    planId: "gather",
    planName: "Gather",
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: "white_glove",
    currentStageLabel: "White Glove Implementation",
    lastContactAt: now,
    createdAt: now,
    updatedAt: now,
    supportOpenCount: 0,
    salesStage: "closed_won",
    customerSuccessStage: "implementation",
    accessDisabled: true,
    ...overrides,
  };
}

function completedChecklist(relationshipId: string): RelationshipTask[] {
  const now = new Date().toISOString();
  return WHITE_GLOVE_CHECKLIST_TITLES.map((title, i) => ({
    id: `task_${i}`,
    relationshipId,
    title,
    status: "completed" as const,
    priority: "medium" as const,
    ownerId: "tm_eli",
    dueDate: now.slice(0, 10),
    createdAt: now,
    completedAt: now,
    meta: { checklist: WHITE_GLOVE_CHECKLIST_MARKER, sort_order: i },
  }));
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "htc-crm-wg-"));
  process.env.HTC_CRM_STORE = "file";
  process.env.RELATIONSHIPS_DATA_PATH = dataDir;
  process.env.NEXT_PUBLIC_PRODUCT_APP_URL = "https://product.test";
});

after(async () => {
  if (prevStore === undefined) delete process.env.HTC_CRM_STORE;
  else process.env.HTC_CRM_STORE = prevStore;
  if (prevPath === undefined) delete process.env.RELATIONSHIPS_DATA_PATH;
  else process.env.RELATIONSHIPS_DATA_PATH = prevPath;
  if (prevProductUrl === undefined) delete process.env.NEXT_PUBLIC_PRODUCT_APP_URL;
  else process.env.NEXT_PUBLIC_PRODUCT_APP_URL = prevProductUrl;
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

describe("CRM Mark Implementation Complete (launch_workspace)", () => {
  it("does not mint activation token, clear accessDisabled, or move to Active", async () => {
    const { withLiveStore, launchWhiteGloveWorkspace, loadLiveStore } = await import(
      "./index.ts"
    );

    await withLiveStore((store) => {
      store.relationships = [baseRelationship()];
      store.tasks = completedChecklist("rel_wg_test");
      store.timelineEvents = [];
      store.notifications = [];
      return null;
    });

    const result = await launchWhiteGloveWorkspace({ relationshipId: "rel_wg_test" });
    assert.equal(result.ok, true);

    const store = await loadLiveStore();
    const rel = store.relationships.find((r) => r.id === "rel_wg_test");
    assert.ok(rel);
    assert.equal(rel.status, "white_glove_implementation");
    assert.equal(rel.accessDisabled, true);
    assert.equal(rel.activationToken, undefined);
    assert.equal(rel.customerSuccessStage, "implementation");
    assert.match(rel.nextMilestone ?? "", /Finish White Glove Setup/i);

    const milestone = store.timelineEvents.find(
      (e) => e.meta?.crm_implementation_complete === true,
    );
    assert.ok(milestone);
    assert.equal(milestone.meta?.customer_access_granted, false);
    assert.match(milestone.title, /implementation checklist complete/i);
  });

  it("is idempotent for the CRM implementation milestone", async () => {
    const { withLiveStore, launchWhiteGloveWorkspace, loadLiveStore } = await import(
      "./index.ts"
    );

    await withLiveStore((store) => {
      store.relationships = [baseRelationship({ id: "rel_wg_idemp" })];
      store.tasks = completedChecklist("rel_wg_idemp");
      store.timelineEvents = [];
      return null;
    });

    await launchWhiteGloveWorkspace({ relationshipId: "rel_wg_idemp" });
    await launchWhiteGloveWorkspace({ relationshipId: "rel_wg_idemp" });

    const store = await loadLiveStore();
    const events = store.timelineEvents.filter(
      (e) =>
        e.relationshipId === "rel_wg_idemp" &&
        e.meta?.crm_implementation_complete === true,
    );
    assert.equal(events.length, 1);
  });
});

describe("product → CRM milestones", () => {
  it("binds productSync.venueId idempotently", async () => {
    const { withLiveStore, bindCrmProductVenueId, loadLiveStore } = await import("./index.ts");

    await withLiveStore((store) => {
      store.relationships = [
        baseRelationship({
          id: "rel_bind",
          owner: {
            id: "c1",
            firstName: "Ada",
            lastName: "Owner",
            email: "bind@example.com",
          },
        }),
      ];
      return null;
    });

    const first = await bindCrmProductVenueId({
      productVenueId: "11111111-1111-4111-8111-111111111111",
      ownerEmail: "bind@example.com",
    });
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.alreadyBound, false);

    const second = await bindCrmProductVenueId({
      productVenueId: "11111111-1111-4111-8111-111111111111",
      ownerEmail: "bind@example.com",
    });
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.alreadyBound, true);

    const store = await loadLiveStore();
    const rel = store.relationships.find((r) => r.id === "rel_bind");
    assert.equal(rel?.productSync?.venueId, "11111111-1111-4111-8111-111111111111");
  });

  it("records intake, materials, handoff, and activation without duplicates", async () => {
    const venueId = "22222222-2222-4222-8222-222222222222";
    const {
      withLiveStore,
      recordCrmWhiteGloveIntakeSubmitted,
      recordCrmWhiteGloveMaterialsReceived,
      recordCrmWhiteGloveHandoffComplete,
      recordCrmProductAccountActivated,
      loadLiveStore,
    } = await import("./index.ts");

    await withLiveStore((store) => {
      store.relationships = [
        baseRelationship({
          id: "rel_sync",
          productSync: {
            status: "idle",
            steps: [],
            adapter: "local",
            venueId,
          },
        }),
      ];
      store.timelineEvents = [];
      return null;
    });

    await recordCrmWhiteGloveIntakeSubmitted({ productVenueId: venueId });
    await recordCrmWhiteGloveIntakeSubmitted({ productVenueId: venueId });
    await recordCrmWhiteGloveMaterialsReceived({ productVenueId: venueId, fileCount: 2 });
    await recordCrmWhiteGloveMaterialsReceived({ productVenueId: venueId, fileCount: 2 });
    await recordCrmWhiteGloveHandoffComplete({
      productVenueId: venueId,
      ownerEmail: "ada@example.com",
    });
    await recordCrmWhiteGloveHandoffComplete({ productVenueId: venueId });
    await recordCrmProductAccountActivated({ productVenueId: venueId });
    await recordCrmProductAccountActivated({ productVenueId: venueId });

    const store = await loadLiveStore();
    const titles = store.timelineEvents
      .filter((e) => e.relationshipId === "rel_sync")
      .map((e) => e.title);

    assert.equal(
      titles.filter((t) => t === "White Glove intake submitted").length,
      1,
    );
    assert.equal(
      titles.filter((t) => t === "White Glove materials received").length,
      1,
    );
    assert.equal(
      titles.filter((t) => t === "White Glove setup completed / customer handoff completed")
        .length,
      1,
    );
    assert.equal(titles.filter((t) => t === "Account Activated").length, 1);

    const rel = store.relationships.find((r) => r.id === "rel_sync");
    assert.ok(rel);
    assert.equal(rel.status, "active");
    assert.equal(rel.customerSuccessStage, "live");
    assert.equal(rel.accessDisabled, false);
    assert.ok(rel.activationCompletedAt);
  });

  it("builds Configure Workspace URL without granting access", async () => {
    const { productConfigureWorkspaceUrl } = await import("./index.ts");
    const url = productConfigureWorkspaceUrl("33333333-3333-4333-8333-333333333333");
    assert.equal(
      url,
      "https://product.test/admin/onboarding/33333333-3333-4333-8333-333333333333",
    );
  });
});

describe("welcome_home trigger metadata", () => {
  it("tags Product HQ Finish White Glove Setup, not CRM launch_workspace", async () => {
    const { sendWelcomeHomeEmail } = await import("../email/enrollment.ts");
    const { withLiveStore, loadLiveStore } = await import("./index.ts");

    await withLiveStore((store) => {
      store.relationships = [baseRelationship({ id: "rel_email" })];
      store.timelineEvents = [];
      store.communications = [];
      return null;
    });

    const result = await sendWelcomeHomeEmail({
      relationshipId: "rel_email",
      customerEmail: "ada@example.com",
      venueName: "Test Venue",
      firstName: "Ada",
      activateUrl: "https://product.test/activate/tok_test",
    });

    assert.ok(result);
    assert.equal(result.ok, true);
    assert.equal(result.templateId, "welcome_home");

    const store = await loadLiveStore();
    const emailEvent = store.timelineEvents.find(
      (e) =>
        e.relationshipId === "rel_email" &&
        e.meta?.template_id === "welcome_home",
    );
    assert.ok(emailEvent);
    assert.equal(emailEvent.meta?.trigger, "product.finish_white_glove_setup");
    assert.notEqual(emailEvent.meta?.trigger, "white_glove.launch_workspace");
  });
});

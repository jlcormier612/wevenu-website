/**
 * R1A durable staff auth — ACL, bootstrap, invite binding, R0 gates (memory provider).
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.WORKSPACE_AUTH_PROVIDER = "memory";
process.env.WORKSPACE_BOOTSTRAP_SECRET = "r1a-test-bootstrap-secret";

import { roleHasPermission } from "./permissions";
import {
  getMemoryStaffAclRepository,
  hashInviteToken,
  setStaffAclRepositoryForTests,
} from "./staff-acl";
import {
  acceptStaffInvite,
  bootstrapFirstOwner,
  createStaffInvite,
  deactivateStaff,
  resolveStaffAfterAuth,
} from "./staff-auth-service";
import { clearMemoryAuth, setMemoryAuthUserId } from "./staff-auth-memory";
import { requireWorkspaceStaff } from "./session";

describe("R1A staff ACL + auth service", () => {
  const repo = getMemoryStaffAclRepository();

  beforeEach(() => {
    repo.reset();
    clearMemoryAuth();
    setStaffAclRepositoryForTests(repo);
    process.env.WORKSPACE_AUTH_PROVIDER = "memory";
    process.env.WORKSPACE_BOOTSTRAP_SECRET = "r1a-test-bootstrap-secret";
  });

  afterEach(() => {
    clearMemoryAuth();
    setStaffAclRepositoryForTests(null);
  });

  it("rejects Auth user without htc_internal_staff membership", async () => {
    const result = await resolveStaffAfterAuth("user-venue-only", "owner@venue.com");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "not_staff");
  });

  it("rejects deactivated staff", async () => {
    const now = new Date().toISOString();
    await repo.upsertStaff({
      userId: "u1",
      teamMemberId: "tm_1",
      email: "staff@htc.test",
      displayName: "Staff",
      role: "viewer",
      active: false,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: now,
      createdBy: null,
    });
    const result = await resolveStaffAfterAuth("u1", "staff@htc.test");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "inactive");
  });

  it("bootstraps first Owner only with secret and empty Owner set", async () => {
    const bad = await bootstrapFirstOwner({
      userId: "u-owner",
      email: "founder@htc.test",
      displayName: "Founder",
      bootstrapSecret: "wrong",
    });
    assert.equal(bad.ok, false);

    process.env.WORKSPACE_BOOTSTRAP_OWNER_EMAIL = "jennifer@hellotocheers.com";
    const wrongEmail = await bootstrapFirstOwner({
      userId: "u-owner",
      email: "founder@htc.test",
      displayName: "Founder",
      bootstrapSecret: "r1a-test-bootstrap-secret",
    });
    assert.equal(wrongEmail.ok, false);

    const ok = await bootstrapFirstOwner({
      userId: "u-owner",
      email: "jennifer@hellotocheers.com",
      displayName: "Jennifer",
      bootstrapSecret: "r1a-test-bootstrap-secret",
      teamMemberId: "tm_jen",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.staff.role, "owner");
      assert.equal(ok.staff.active, true);
      assert.equal(ok.staff.teamMemberId, "tm_jen");
    }

    const again = await bootstrapFirstOwner({
      userId: "u-other",
      email: "jennifer@hellotocheers.com",
      displayName: "Other",
      bootstrapSecret: "r1a-test-bootstrap-secret",
    });
    assert.equal(again.ok, false);
    delete process.env.WORKSPACE_BOOTSTRAP_OWNER_EMAIL;
  });


  it("invite acceptance binds user_id to invited email only", async () => {
    const now = new Date().toISOString();
    await repo.upsertStaff({
      userId: "u-owner",
      teamMemberId: "tm_owner",
      email: "owner@htc.test",
      displayName: "Owner",
      role: "owner",
      active: true,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      createdBy: null,
    });

    const created = await createStaffInvite({
      email: "viewer@htc.test",
      displayName: "Viewer",
      role: "viewer",
      invitedByUserId: "u-owner",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const wrongEmail = await acceptStaffInvite({
      token: created.token,
      userId: "u-viewer",
      email: "someone-else@htc.test",
    });
    assert.equal(wrongEmail.ok, false);

    const ok = await acceptStaffInvite({
      token: created.token,
      userId: "u-viewer",
      email: "viewer@htc.test",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.staff.role, "viewer");
      assert.equal(ok.staff.userId, "u-viewer");
      assert.equal(roleHasPermission(ok.staff.role, "manage_product_sync"), false);
    }

    // Token single-use
    const reuse = await acceptStaffInvite({
      token: created.token,
      userId: "u-viewer-2",
      email: "viewer@htc.test",
    });
    assert.equal(reuse.ok, false);
  });

  it("invite token is stored hashed", async () => {
    const now = new Date().toISOString();
    await repo.upsertStaff({
      userId: "u-owner",
      teamMemberId: "tm_owner",
      email: "owner@htc.test",
      displayName: "Owner",
      role: "owner",
      active: true,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      createdBy: null,
    });
    const created = await createStaffInvite({
      email: "a@htc.test",
      displayName: "A",
      role: "support",
      invitedByUserId: "u-owner",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.invite.tokenHash, hashInviteToken(created.token));
    assert.notEqual(created.invite.tokenHash, created.token);
  });

  it("deactivation revokes access; Owner cannot be deactivated by Admin", async () => {
    const now = new Date().toISOString();
    await repo.upsertStaff({
      userId: "u-owner",
      teamMemberId: "tm_owner",
      email: "owner@htc.test",
      displayName: "Owner",
      role: "owner",
      active: true,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      createdBy: null,
    });
    await repo.upsertStaff({
      userId: "u-admin",
      teamMemberId: "tm_admin",
      email: "admin@htc.test",
      displayName: "Admin",
      role: "administrator",
      active: true,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      createdBy: "u-owner",
    });
    await repo.upsertStaff({
      userId: "u-view",
      teamMemberId: "tm_view",
      email: "view@htc.test",
      displayName: "View",
      role: "viewer",
      active: true,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      createdBy: "u-owner",
    });

    const denyOwner = await deactivateStaff({
      targetUserId: "u-owner",
      actorUserId: "u-admin",
    });
    assert.equal(denyOwner.ok, false);

    const ok = await deactivateStaff({
      targetUserId: "u-view",
      actorUserId: "u-admin",
    });
    assert.equal(ok.ok, true);
    const resolved = await resolveStaffAfterAuth("u-view", "view@htc.test");
    assert.equal(resolved.ok, false);
  });

  it("requireWorkspaceStaff: anon 401, viewer 403 on product-sync, owner allowed", async () => {
    const now = new Date().toISOString();
    await repo.upsertStaff({
      userId: "u-owner",
      teamMemberId: "tm_owner",
      email: "owner@htc.test",
      displayName: "Owner",
      role: "owner",
      active: true,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      createdBy: null,
    });
    await repo.upsertStaff({
      userId: "u-view",
      teamMemberId: "tm_view",
      email: "view@htc.test",
      displayName: "View",
      role: "viewer",
      active: true,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      createdBy: "u-owner",
    });

    clearMemoryAuth();
    const anon = await requireWorkspaceStaff("manage_product_sync");
    assert.equal(anon.ok, false);
    if (!anon.ok) assert.equal(anon.response.status, 401);

    setMemoryAuthUserId("u-view");
    const viewer = await requireWorkspaceStaff("manage_product_sync");
    assert.equal(viewer.ok, false);
    if (!viewer.ok) assert.equal(viewer.response.status, 403);

    setMemoryAuthUserId("u-owner");
    const owner = await requireWorkspaceStaff("manage_product_sync");
    assert.equal(owner.ok, true);

    // Venue-like Auth user with no ACL
    setMemoryAuthUserId("u-venue-customer");
    const venue = await requireWorkspaceStaff();
    assert.equal(venue.ok, false);
    if (!venue.ok) assert.equal(venue.response.status, 401);
  });

  it("does not auto-seed demo credentials in supabase/memory mode", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = existsSync(join(process.cwd(), "workspace/lib/program4/store.ts"))
      ? join(process.cwd(), "workspace")
      : process.cwd();
    const storeSrc = readFileSync(join(root, "lib/program4/store.ts"), "utf8");
    assert.match(storeSrc, /isLegacyJsonlAuthEnabled/);
    const settingsSrc = readFileSync(
      join(root, "app/(app)/settings/page.tsx"),
      "utf8",
    );
    assert.equal(settingsSrc.includes("DEMO_LOGIN"), false);
    assert.equal(settingsSrc.includes("cheers-demo"), false);
  });

  it("inbound webhook remains fail-closed (R0 preserved)", async () => {
    const { authorizeInboundWebhook } = await import(
      "../email/inbound-webhook-auth"
    );
    assert.equal(
      authorizeInboundWebhook("{}", { get: () => null }, ""),
      false,
    );
  });

  it("sessions do not use JSONL session store in memory/supabase mode", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = existsSync(join(process.cwd(), "workspace/lib/program4/session.ts"))
      ? join(process.cwd(), "workspace")
      : process.cwd();
    const sessionSrc = readFileSync(join(root, "lib/program4/session.ts"), "utf8");
    assert.match(sessionSrc, /requireActiveInternalStaff/);
    assert.match(sessionSrc, /isSupabaseStaffAuthEnabled/);
  });
});


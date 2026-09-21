import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_TITLES,
  BASIS_TITLES,
  CAPABILITY_CATALOG,
  CAPABILITY_KEYS,
  assertCanManageMember,
  assertCatalogComplete,
  displayAccessTitle,
  hasCapability,
  hasOwnershipOnlyCapability,
  isOverrideDenied,
  listOwnershipOnlyCapabilities,
  overridesAfterTitleChange,
  ownershipOnlyCapabilityKeys,
  presetCapabilities,
  presetHas,
  resolveEffectiveAccess,
  sensitiveCapabilityKeys,
  titlesActorMayManage,
  type CapabilityKey,
  type MembershipAccessInput,
  type TeamActor,
} from "@/lib/authorization";

function member(
  partial: Partial<MembershipAccessInput> & Pick<MembershipAccessInput, "accessTitle">,
): MembershipAccessInput {
  return {
    isActive: true,
    isOwner: false,
    overrides: null,
    ...partial,
  };
}

function adminActor(overrides?: Partial<TeamActor>): TeamActor {
  const caps = presetCapabilities("administrator");
  return {
    isOwner: false,
    accessTitle: "administrator",
    effectiveCapabilities: caps,
    ...overrides,
  };
}

function managerActor(overrides?: Partial<TeamActor>): TeamActor {
  return {
    isOwner: false,
    accessTitle: "manager",
    effectiveCapabilities: presetCapabilities("manager"),
    ...overrides,
  };
}

describe("catalog integrity", () => {
  it("covers every capability key exactly once", () => {
    assertCatalogComplete();
    assert.equal(CAPABILITY_CATALOG.length, CAPABILITY_KEYS.length);
    assert.deepEqual(
      CAPABILITY_CATALOG.map((c) => c.key),
      [...CAPABILITY_KEYS],
    );
  });

  it("marks ownership-only and billing as override-denied", () => {
    for (const key of ownershipOnlyCapabilityKeys()) {
      assert.equal(isOverrideDenied(key), true, key);
    }
    assert.equal(isOverrideDenied("account.billing"), true);
    assert.equal(isOverrideDenied("payments.view"), false);
  });
});

describe("title default matrices", () => {
  it("administrator has full operational access without ownership-only caps", () => {
    const caps = presetCapabilities("administrator");
    assert.equal(caps.has("payments.refund"), true);
    assert.equal(caps.has("data.export"), true);
    assert.equal(caps.has("settings.integrations"), true);
    assert.equal(caps.has("settings.texting"), true);
    assert.equal(caps.has("team.invite"), true);
    assert.equal(caps.has("contracts.venue_sign"), true);
    for (const key of listOwnershipOnlyCapabilities()) {
      assert.equal(caps.has(key), false, key);
    }
  });

  it("Owner ≠ Administrator: ownership-only requires isOwner, not administrator title", () => {
    const admin = member({ accessTitle: "administrator", isOwner: false });
    for (const key of listOwnershipOnlyCapabilities()) {
      assert.equal(hasCapability(admin, key), false, key);
      assert.equal(hasOwnershipOnlyCapability(true, false, key), false, key);
      assert.equal(hasOwnershipOnlyCapability(true, true, key), true, key);
    }
    assert.equal(hasCapability(member({ accessTitle: "administrator", isOwner: true }), "account.billing"), true);
    assert.equal(hasCapability(admin, "payments.refund"), true);
  });

  it("manager defaults: broad ops; refund/export/integrations/texting off", () => {
    const caps = presetCapabilities("manager");
    assert.equal(caps.has("clients.edit"), true);
    assert.equal(caps.has("payments.void_invoice"), true);
    assert.equal(caps.has("contracts.venue_sign"), true);
    assert.equal(caps.has("team.invite"), true);
    assert.equal(caps.has("payments.refund"), false);
    assert.equal(caps.has("data.export"), false);
    assert.equal(caps.has("settings.integrations"), false);
    assert.equal(caps.has("settings.texting"), false);
    assert.equal(caps.has("settings.venue_profile"), false);
  });

  it("coordinator defaults include payments.create_edit, mark_paid, cancel_unpaid; exclude void/delete/refund/export/team admin", () => {
    const caps = presetCapabilities("coordinator");
    assert.equal(caps.has("payments.view"), true);
    assert.equal(caps.has("payments.create_edit"), true);
    assert.equal(caps.has("payments.mark_paid"), true);
    assert.equal(caps.has("payments.cancel_unpaid"), true);
    assert.equal(caps.has("payments.void_invoice"), false);
    assert.equal(caps.has("payments.delete"), false);
    assert.equal(caps.has("payments.refund"), false);
    assert.equal(caps.has("data.export"), false);
    assert.equal(caps.has("team.invite"), false);
    assert.equal(caps.has("settings.integrations"), false);
    assert.equal(caps.has("settings.texting"), false);
    assert.equal(caps.has("contracts.venue_sign"), false);
    assert.equal(caps.has("events.floor_plans"), true);
  });

  it("staff is limited: messaging view/send and views; no finance, no full planning manage, no team admin", () => {
    const caps = presetCapabilities("staff");
    assert.equal(caps.has("messaging.view"), true);
    assert.equal(caps.has("messaging.send"), true);
    assert.equal(caps.has("clients.view"), true);
    assert.equal(caps.has("events.view"), true);
    assert.equal(caps.has("events.tasks"), false);
    assert.equal(caps.has("events.floor_plans"), false);
    assert.equal(caps.has("events.create"), false);
    assert.equal(caps.has("clients.create"), false);
    assert.equal(caps.has("payments.view"), false);
    assert.equal(caps.has("messaging.templates"), false);
    assert.equal(caps.has("team.invite"), false);
  });

  it("view_only is view surfaces only; finance/reports off by default", () => {
    const caps = presetCapabilities("view_only");
    assert.equal(caps.has("clients.view"), true);
    assert.equal(caps.has("messaging.send"), false);
    assert.equal(caps.has("clients.edit"), false);
    assert.equal(caps.has("payments.view"), false);
    assert.equal(caps.has("reports.view"), false);
  });

  it("every basis title is defined", () => {
    for (const title of BASIS_TITLES) {
      assert.ok(presetCapabilities(title).size >= 0);
    }
    assert.ok(ACCESS_TITLES.includes("custom"));
  });
});

describe("sensitive capabilities", () => {
  it("lists approved sensitive keys", () => {
    const sensitive = new Set(sensitiveCapabilityKeys());
    for (const key of [
      "payments.refund",
      "data.export",
      "settings.integrations",
      "settings.texting",
      "contracts.venue_sign",
      "team.invite",
      "clients.delete",
      "account.billing",
    ] as CapabilityKey[]) {
      assert.equal(sensitive.has(key), true, key);
    }
  });
});

describe("custom + overrides", () => {
  it("custom basis inherits preset capabilities", () => {
    const resolved = resolveEffectiveAccess(member({
      accessTitle: "custom",
      titleBasis: "coordinator",
      overrides: {},
    }));
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.titleBasis, "coordinator");
    assert.equal(resolved.capabilities.has("payments.create_edit"), true);
    assert.equal(resolved.capabilities.has("payments.refund"), false);
  });

  it("explicit false override removes a default capability", () => {
    const resolved = resolveEffectiveAccess(member({
      accessTitle: "coordinator",
      overrides: { "payments.mark_paid": false },
    }));
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.capabilities.has("payments.mark_paid"), false);
    assert.equal(resolved.capabilities.has("payments.view"), true);
  });

  it("explicit true override grants only allowlisted/grantable capabilities", () => {
    const okRefund = resolveEffectiveAccess(member({
      accessTitle: "manager",
      overrides: { "payments.refund": true },
    }));
    assert.equal(okRefund.ok, true);
    if (okRefund.ok) assert.equal(okRefund.capabilities.has("payments.refund"), true);

    const okExport = resolveEffectiveAccess(member({
      accessTitle: "manager",
      overrides: { "data.export": true },
    }));
    assert.equal(okExport.ok, true);

    const denyRefundOnCoordinator = resolveEffectiveAccess(member({
      accessTitle: "coordinator",
      overrides: { "payments.refund": true },
    }));
    assert.equal(denyRefundOnCoordinator.ok, false);
    if (!denyRefundOnCoordinator.ok) {
      assert.equal(denyRefundOnCoordinator.reason, "ungrantable_override");
    }

    const denyIntegrationsOnManager = resolveEffectiveAccess(member({
      accessTitle: "manager",
      overrides: { "settings.integrations": true },
    }));
    assert.equal(denyIntegrationsOnManager.ok, false);
  });

  it("ownership-only capabilities can never be granted through overrides", () => {
    for (const key of listOwnershipOnlyCapabilities()) {
      const result = resolveEffectiveAccess(member({
        accessTitle: "administrator",
        overrides: { [key]: true },
      }));
      assert.equal(result.ok, false, key);
      if (!result.ok) {
        assert.ok(
          result.reason === "ownership_only_override" || result.reason === "billing_override",
          result.reason,
        );
      }
    }
  });

  it("account.billing cannot be granted through overrides", () => {
    const result = resolveEffectiveAccess(member({
      accessTitle: "administrator",
      overrides: { "account.billing": true },
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "billing_override");
  });

  it("unknown capability keys fail closed", () => {
    const result = resolveEffectiveAccess(member({
      accessTitle: "manager",
      overrides: { "not.a.real.cap": true } as never,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unknown_capability_override");
    assert.equal(hasCapability(member({ accessTitle: "administrator" }), "nope"), false);
  });

  it("unknown titles fail closed", () => {
    const result = resolveEffectiveAccess(member({ accessTitle: "superuser" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unknown_title");
  });

  it("custom without valid basis fails closed", () => {
    const result = resolveEffectiveAccess(member({ accessTitle: "custom", titleBasis: null }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unknown_basis");
  });

  it("displayAccessTitle becomes custom when overrides differ", () => {
    assert.equal(displayAccessTitle("manager", "manager", null), "manager");
    assert.equal(
      displayAccessTitle("manager", "manager", { "payments.refund": true }),
      "custom",
    );
  });
});

describe("inactive membership", () => {
  it("is never authorized by capability resolution", () => {
    const result = resolveEffectiveAccess(member({
      accessTitle: "administrator",
      isActive: false,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "inactive_membership");
    assert.equal(
      hasCapability(member({ accessTitle: "administrator", isActive: false }), "clients.view"),
      false,
    );
    assert.equal(hasOwnershipOnlyCapability(false, true, "account.billing"), false);
  });
});

describe("title-change reset semantics", () => {
  it("overridesAfterTitleChange clears prior overrides", () => {
    const next = overridesAfterTitleChange(
      "coordinator",
      "manager",
      { "payments.mark_paid": false, "reports.view": true },
    );
    assert.deepEqual(next, {});
  });
});

describe("target-scope validation", () => {
  it("Owner may manage all titles and designate Owners", () => {
    const owner: TeamActor = {
      isOwner: true,
      accessTitle: "administrator",
      effectiveCapabilities: presetCapabilities("administrator"),
    };
    assert.ok(titlesActorMayManage(owner).has("administrator"));
    assert.ok(titlesActorMayManage(owner).has("manager"));
    const result = assertCanManageMember(owner, {
      isOwner: true,
      accessTitle: "administrator",
    });
    assert.equal(result.ok, true);
  });

  it("Administrator may manage Administrators but cannot grant ownership", () => {
    const actor = adminActor();
    assert.ok(titlesActorMayManage(actor).has("administrator"));
    const denyOwner = assertCanManageMember(actor, {
      isOwner: true,
      accessTitle: "administrator",
    });
    assert.equal(denyOwner.ok, false);
    if (!denyOwner.ok) assert.equal(denyOwner.reason, "ownership_grant_forbidden");

    const allowAdmin = assertCanManageMember(actor, {
      isOwner: false,
      accessTitle: "administrator",
    });
    assert.equal(allowAdmin.ok, true);
  });

  it("Manager may manage Coordinator/Staff/View Only only", () => {
    const actor = managerActor();
    assert.deepEqual([...titlesActorMayManage(actor)].sort(), [
      "coordinator",
      "custom",
      "staff",
      "view_only",
    ]);
    assert.equal(
      assertCanManageMember(actor, { isOwner: false, accessTitle: "manager" }).ok,
      false,
    );
    assert.equal(
      assertCanManageMember(actor, { isOwner: false, accessTitle: "administrator" }).ok,
      false,
    );
    assert.equal(
      assertCanManageMember(actor, { isOwner: false, accessTitle: "coordinator" }).ok,
      true,
    );
  });

  it("Custom cannot bypass Manager target-scope via effective capabilities", () => {
    const actor = managerActor();
    const escalate = assertCanManageMember(actor, {
      isOwner: false,
      accessTitle: "custom",
      titleBasis: "coordinator",
      overrides: { "settings.integrations": true },
    });
    assert.equal(escalate.ok, false);

    const teamPower = assertCanManageMember(actor, {
      isOwner: false,
      accessTitle: "custom",
      titleBasis: "staff",
      overrides: { "team.invite": true },
    });
    assert.equal(teamPower.ok, false);

    const okCustom = assertCanManageMember(actor, {
      isOwner: false,
      accessTitle: "custom",
      titleBasis: "coordinator",
      overrides: { "payments.mark_paid": false },
    });
    assert.equal(okCustom.ok, true);
  });

  it("Coordinator/Staff/View Only have no team-management authority by default", () => {
    for (const title of ["coordinator", "staff", "view_only"] as const) {
      const actor: TeamActor = {
        isOwner: false,
        accessTitle: title,
        effectiveCapabilities: presetCapabilities(title),
      };
      assert.equal(titlesActorMayManage(actor).size, 0);
      assert.equal(
        assertCanManageMember(actor, { isOwner: false, accessTitle: "staff" }).ok,
        false,
      );
    }
  });
});

describe("presetHas helper", () => {
  it("matches presetCapabilities", () => {
    assert.equal(presetHas("coordinator", "payments.create_edit"), true);
    assert.equal(presetHas("staff", "payments.view"), false);
  });
});

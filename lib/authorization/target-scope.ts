import { getCapabilityDefinition } from "@/lib/authorization/catalog";
import { presetHas } from "@/lib/authorization/presets";
import { isAccessTitle, resolveEffectiveAccess } from "@/lib/authorization/resolve";
import type {
  AccessTitle,
  CapabilityKey,
  TeamActor,
  TeamTargetDraft,
} from "@/lib/authorization/types";

export type TargetScopeResult =
  | { ok: true }
  | { ok: false; reason: string; message: string };

function actorTitle(actor: TeamActor): AccessTitle | null {
  return isAccessTitle(actor.accessTitle) ? actor.accessTitle : null;
}

/**
 * Access titles this actor may assign or leave on a non-owner target.
 *
 * Owner → all titles
 * Administrator → Administrator/Manager/Coordinator/Staff/View Only/Custom
 * Manager → Coordinator/Staff/View Only/Custom
 * Others → none (unless later granted team caps; still scoped by title rules above)
 */
export function titlesActorMayManage(actor: TeamActor): ReadonlySet<AccessTitle> {
  if (actor.isOwner) {
    return new Set(["administrator", "manager", "coordinator", "staff", "view_only", "custom"]);
  }
  const title = actorTitle(actor);
  if (title === "administrator") {
    return new Set(["administrator", "manager", "coordinator", "staff", "view_only", "custom"]);
  }
  if (title === "manager") {
    return new Set(["coordinator", "staff", "view_only", "custom"]);
  }
  return new Set();
}

export function mayManageExistingTitle(actor: TeamActor, targetTitle: AccessTitle | string): boolean {
  if (!isAccessTitle(targetTitle)) return false;
  return titlesActorMayManage(actor).has(targetTitle);
}

function managerMayAssignCapability(key: CapabilityKey): boolean {
  const def = getCapabilityDefinition(key);
  if (def.ownershipOnly) return false;
  if (
    presetHas("coordinator", key)
    || presetHas("staff", key)
    || presetHas("view_only", key)
  ) {
    return true;
  }
  return (
    def.grantableTo.includes("coordinator")
    || def.grantableTo.includes("staff")
    || def.grantableTo.includes("view_only")
  );
}

/**
 * Validate invite or edit of another member.
 * Evaluates the target's effective capability set, not merely the title label.
 */
export function assertCanManageMember(actor: TeamActor, draft: TeamTargetDraft): TargetScopeResult {
  if (draft.isOwner && !actor.isOwner) {
    return {
      ok: false,
      reason: "ownership_grant_forbidden",
      message: "Only an Owner may add or designate another Owner.",
    };
  }

  if (!actor.isOwner) {
    const canTeam =
      actor.effectiveCapabilities.has("team.invite")
      || actor.effectiveCapabilities.has("team.change_access")
      || actor.effectiveCapabilities.has("team.remove");
    if (!canTeam) {
      return {
        ok: false,
        reason: "missing_team_capability",
        message: "You do not have permission to manage team access.",
      };
    }
  }

  if (!isAccessTitle(draft.accessTitle)) {
    return { ok: false, reason: "unknown_title", message: `Unknown target title: ${draft.accessTitle}.` };
  }

  const allowedTitles = titlesActorMayManage(actor);
  if (!allowedTitles.has(draft.accessTitle)) {
    return {
      ok: false,
      reason: "title_out_of_scope",
      message: `You cannot assign or manage the ${draft.accessTitle} access title.`,
    };
  }

  const resolved = resolveEffectiveAccess({
    isActive: true,
    isOwner: false, // ownership handled separately; do not mix into operational set
    accessTitle: draft.accessTitle,
    titleBasis: draft.titleBasis,
    overrides: draft.overrides,
  });
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, message: resolved.message };
  }

  if (!actor.isOwner && actorTitle(actor) === "manager") {
    for (const key of resolved.capabilities) {
      if (!managerMayAssignCapability(key)) {
        return {
          ok: false,
          reason: "effective_capabilities_out_of_scope",
          message: `Resulting access includes ${key}, which exceeds Manager target scope.`,
        };
      }
    }
    // Manager must not assign team-admin powers even if somehow in a basis preset (they are not).
    for (const key of ["team.invite", "team.change_access", "team.remove", "settings.integrations", "settings.texting"] as const) {
      if (resolved.capabilities.has(key)) {
        return {
          ok: false,
          reason: "effective_capabilities_out_of_scope",
          message: `Resulting access includes ${key}, which exceeds Manager target scope.`,
        };
      }
    }
  }

  return { ok: true };
}

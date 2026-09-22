import {
  getCapabilityDefinition,
  isCapabilityKey,
  isOverrideDenied,
  ownershipOnlyCapabilityKeys,
} from "@/lib/authorization/catalog";
import { presetCapabilities } from "@/lib/authorization/presets";
import type {
  AccessTitle,
  BasisTitle,
  CapabilityKey,
  CapabilityOverrides,
  EffectiveAccess,
  MembershipAccessInput,
} from "@/lib/authorization/types";
import { ACCESS_TITLES, BASIS_TITLES } from "@/lib/authorization/types";

export function isAccessTitle(value: string): value is AccessTitle {
  return (ACCESS_TITLES as readonly string[]).includes(value);
}

export function isBasisTitle(value: string): value is BasisTitle {
  return (BASIS_TITLES as readonly string[]).includes(value);
}

/**
 * Title-change semantics: replacing the title resets overrides.
 * Pure representation of the least-surprising reset rule.
 */
export function overridesAfterTitleChange(
  _previousTitle: AccessTitle,
  _nextTitle: AccessTitle,
  _previousOverrides: CapabilityOverrides | null | undefined,
): CapabilityOverrides {
  return {};
}

type EffectiveAccessFailReason = Extract<EffectiveAccess, { ok: false }>["reason"];

function validateOverrides(
  basis: BasisTitle,
  overrides: CapabilityOverrides | null | undefined,
): { ok: true; overrides: CapabilityOverrides } | { ok: false; reason: EffectiveAccessFailReason; message: string } {
  if (!overrides) return { ok: true, overrides: {} };
  const cleaned: Partial<Record<CapabilityKey, boolean>> = {};
  for (const [rawKey, rawVal] of Object.entries(overrides)) {
    if (typeof rawVal !== "boolean") {
      return { ok: false, reason: "unknown_capability_override", message: `Invalid override value for ${rawKey}.` };
    }
    if (!isCapabilityKey(rawKey)) {
      return { ok: false, reason: "unknown_capability_override", message: `Unknown capability override: ${rawKey}.` };
    }
    if (isOverrideDenied(rawKey)) {
      if (rawKey === "account.billing" || getCapabilityDefinition(rawKey).ownershipOnly) {
        return {
          ok: false,
          reason: rawKey === "account.billing" ? "billing_override" : "ownership_only_override",
          message: `Capability ${rawKey} cannot be granted through overrides.`,
        };
      }
    }
    const def = getCapabilityDefinition(rawKey);
    if (!def.customizable) {
      return {
        ok: false,
        reason: "ownership_only_override",
        message: `Capability ${rawKey} is not customizable.`,
      };
    }
    // Explicit true that is not already in the basis preset must be grantable to this basis.
    const inPreset = presetCapabilities(basis).has(rawKey);
    if (rawVal === true && !inPreset && !def.grantableTo.includes(basis)) {
      return {
        ok: false,
        reason: "ungrantable_override",
        message: `Capability ${rawKey} cannot be granted to basis ${basis}.`,
      };
    }
    // Explicit false removing a default is always OK for customizable caps.
    // Skip no-op overrides (same as preset) — still allowed but not required.
    cleaned[rawKey] = rawVal;
  }
  return { ok: true, overrides: cleaned };
}

function applyOverrides(
  basisCaps: ReadonlySet<CapabilityKey>,
  overrides: CapabilityOverrides,
): Set<CapabilityKey> {
  const next = new Set<CapabilityKey>(basisCaps);
  for (const [key, value] of Object.entries(overrides) as [CapabilityKey, boolean][]) {
    if (value) next.add(key);
    else next.delete(key);
  }
  return next;
}

/**
 * Resolve effective operational capabilities from title + sparse overrides.
 * Ownership-only capabilities are NOT included here — callers combine with isOwner.
 */
export function resolveEffectiveAccess(input: MembershipAccessInput): EffectiveAccess {
  if (!input.isActive) {
    return { ok: false, reason: "inactive_membership", message: "Inactive membership has no access." };
  }
  if (!isAccessTitle(input.accessTitle)) {
    return { ok: false, reason: "unknown_title", message: `Unknown access title: ${input.accessTitle}.` };
  }

  let titleBasis: BasisTitle;
  if (input.accessTitle === "custom") {
    const basis = input.titleBasis;
    if (!basis || !isBasisTitle(basis)) {
      return { ok: false, reason: "unknown_basis", message: "Custom profiles require a valid title_basis." };
    }
    titleBasis = basis;
  } else {
    titleBasis = input.accessTitle;
  }

  const validated = validateOverrides(titleBasis, input.overrides);
  if (!validated.ok) {
    return { ok: false, reason: validated.reason, message: validated.message };
  }

  const capabilities = applyOverrides(presetCapabilities(titleBasis), validated.overrides);
  return {
    ok: true,
    accessTitle: input.accessTitle,
    titleBasis,
    isOwner: input.isOwner,
    capabilities,
  };
}

/**
 * True when the member may perform an operational capability.
 * Ownership-only keys require isOwner and are never satisfied by title/overrides alone.
 */
export function hasCapability(
  input: MembershipAccessInput,
  capability: string,
): boolean {
  if (!isCapabilityKey(capability)) return false;
  if (getCapabilityDefinition(capability).ownershipOnly) {
    return input.isActive && input.isOwner === true;
  }
  const resolved = resolveEffectiveAccess(input);
  if (!resolved.ok) return false;
  return resolved.capabilities.has(capability);
}

export function hasOwnershipOnlyCapability(
  isActive: boolean,
  isOwner: boolean,
  capability: string,
): boolean {
  if (!isCapabilityKey(capability)) return false;
  if (!getCapabilityDefinition(capability).ownershipOnly) return false;
  return isActive && isOwner;
}

export function listOwnershipOnlyCapabilities(): readonly CapabilityKey[] {
  return ownershipOnlyCapabilityKeys();
}

/**
 * Display helper: title becomes Custom when overrides differ from basis preset
 * or accessTitle is already custom.
 */
export function displayAccessTitle(
  accessTitle: AccessTitle,
  _titleBasis: BasisTitle,
  overrides: CapabilityOverrides | null | undefined,
): AccessTitle {
  if (accessTitle === "custom") return "custom";
  if (!overrides || Object.keys(overrides).length === 0) return accessTitle;
  // accessTitle is a basis title here (custom already returned).
  const preset = presetCapabilities(accessTitle);
  for (const [key, value] of Object.entries(overrides) as [CapabilityKey, boolean][]) {
    const inPreset = preset.has(key);
    if (value !== inPreset) return "custom";
  }
  return accessTitle;
}

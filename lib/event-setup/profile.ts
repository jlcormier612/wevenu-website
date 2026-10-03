/**
 * Venue Setup Profile — reusable operating decisions, snapshotted onto events.
 *
 * Profile edits apply to events created after the edit.
 * Existing events keep the setup they inherited.
 * Overrides stay on the event and are never rewritten by a profile edit.
 */
import { eventTypeLabel, normalizeEventType } from "@/lib/event-types/canonical";
import {
  isSetupStepKey,
  type EventSetupState,
  type SetupDecision,
  type SetupDecisions,
  type SetupStepKey,
} from "@/lib/event-setup/state";

export type SetupTemplateRefs = {
  planningPlaybookTemplateId?: string | null;
  timelineTemplateId?: string | null;
};

export type VenueSetupProfile = {
  id: string;
  name: string;
  decisions: SetupDecisions;
  templateRefs: SetupTemplateRefs;
};

export type SetupProfileAssignment = {
  profileId: string;
  /** null = venue default when no event-type assignment matches. */
  eventType: string | null;
};

export function parseSetupDecisions(raw: unknown): SetupDecisions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SetupDecisions = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSetupStepKey(key)) continue;
    if (value === "set_up" || value === "skipped") out[key] = value;
  }
  return out;
}

export function parseTemplateRefs(raw: unknown): SetupTemplateRefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  return {
    planningPlaybookTemplateId: typeof row.planningPlaybookTemplateId === "string" ? row.planningPlaybookTemplateId : null,
    timelineTemplateId: typeof row.timelineTemplateId === "string" ? row.timelineTemplateId : null,
  };
}

/**
 * One clear profile: the event type wins, then the venue default.
 * Unknown or blank types use the venue default only.
 */
export function resolveSetupProfile(
  profiles: readonly VenueSetupProfile[],
  assignments: readonly SetupProfileAssignment[],
  eventType: string | null | undefined,
): VenueSetupProfile | null {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const normalized = normalizeEventType(eventType ?? null);
  if (normalized) {
    const typed = assignments.find((row) => row.eventType === normalized);
    if (typed) return byId.get(typed.profileId) ?? null;
  }
  const fallback = assignments.find((row) => row.eventType == null);
  return fallback ? byId.get(fallback.profileId) ?? null : null;
}

export function snapshotInheritedSetup(profile: VenueSetupProfile): EventSetupState {
  return {
    decisions: {},
    collapsedAt: null,
    usesProfile: true,
    profileId: profile.id,
    profileName: profile.name,
    inheritedDecisions: { ...profile.decisions },
    overrides: {},
  };
}

/** Replacing the profile refreshes the snapshot and keeps event overrides. */
export function reassignInheritedSetup(
  current: EventSetupState,
  profile: VenueSetupProfile,
): EventSetupState {
  return {
    ...current,
    usesProfile: true,
    profileId: profile.id,
    profileName: profile.name,
    inheritedDecisions: { ...profile.decisions },
    overrides: { ...(current.overrides ?? {}) },
    decisions: {},
  };
}

export function missingProfileDecisions(
  applicable: readonly SetupStepKey[],
  decisions: SetupDecisions,
): SetupStepKey[] {
  return applicable.filter((step) => decisions[step] !== "set_up" && decisions[step] !== "skipped");
}

export function profileDecides(
  decisions: SetupDecisions,
  step: SetupStepKey,
): SetupDecision | undefined {
  return decisions[step];
}

export function setupProfileUsedForLabel(eventTypes: readonly (string | null)[]): string {
  if (eventTypes.length === 0) return "Not assigned";
  return eventTypes.map((type) => {
    if (type == null) return "Venue default";
    if (type === "wedding") return "All Weddings";
    if (type === "corporate") return "Corporate Events";
    const label = eventTypeLabel(type);
    return label ? label : type;
  }).join(" · ");
}

export function eventSetupFromColumns(row: {
  collapsed_at: string | null;
  decisions: unknown;
  uses_profile?: boolean | null;
  profile_id?: string | null;
  profile_name?: string | null;
  inherited_decisions?: unknown;
  overrides?: unknown;
} | null): EventSetupState {
  if (!row) {
    return {
      decisions: {},
      collapsedAt: null,
      usesProfile: false,
      profileId: null,
      profileName: null,
      inheritedDecisions: {},
      overrides: {},
    };
  }
  return {
    decisions: parseSetupDecisions(row.decisions),
    collapsedAt: row.collapsed_at,
    usesProfile: row.uses_profile === true,
    profileId: row.profile_id ?? null,
    profileName: row.profile_name ?? null,
    inheritedDecisions: parseSetupDecisions(row.inherited_decisions),
    overrides: parseSetupDecisions(row.overrides),
  };
}

/** Profile events persist the snapshot and overrides, never a copied decision map. */
export function eventSetupToColumns(state: EventSetupState): {
  collapsed_at: string | null;
  decisions: SetupDecisions;
  uses_profile: boolean;
  profile_id: string | null;
  profile_name: string | null;
  inherited_decisions: SetupDecisions;
  overrides: SetupDecisions;
} {
  return {
    collapsed_at: state.collapsedAt,
    decisions: state.usesProfile ? {} : state.decisions,
    uses_profile: state.usesProfile === true,
    profile_id: state.profileId ?? null,
    profile_name: state.profileName ?? null,
    inherited_decisions: state.inheritedDecisions ?? {},
    overrides: state.overrides ?? {},
  };
}

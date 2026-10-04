"use client";

import * as React from "react";

import { toast } from "sonner";

import { saveLeadSpacePreferencesAction } from "@/app/(app)/leads/[id]/actions";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { VenueSpace } from "@/lib/availability/types";
import { resolveExperienceProfile } from "@/lib/event-experience";
import type { LeadEventSpacePreference } from "@/lib/leads/space-preferences";
import {
  isApplicableLeadSpacePreferenceKind,
  normalizeLeadSpacePreference,
  occupancyAnchorSpaceIdFromPreferences,
} from "@/lib/leads/space-preferences";
import { spacesEligibleForUse } from "@/lib/venue-spaces/assignments";
import {
  allowsExternalLocation,
  relevantUsesForExperience,
} from "@/lib/venue-spaces/relevant-uses";
import type { SpaceOperatingMode } from "@/lib/venue-spaces/uses";
import { labelForUseKey } from "@/lib/venue-spaces/uses";

/** Never-saved candidate: UI starts unchecked (not_applicable), not undecided. */
function missingPref(useKey: string): LeadEventSpacePreference {
  return { useKey, preferenceKind: "not_applicable", spaceId: null, externalLocation: null };
}

export type LeadSpaceAssignmentDisplay = {
  useKey: string;
  useLabel: string;
  spaceName: string;
};

function preferenceSelectValue(pref: LeadEventSpacePreference): string {
  if (pref.preferenceKind === "venue_space" && pref.spaceId) return `space:${pref.spaceId}`;
  if (pref.preferenceKind === "external") return "external";
  return "undecided";
}

function preferenceFromSelectValue(
  useKey: string,
  raw: string,
  externalDraft: string,
): LeadEventSpacePreference {
  if (raw === "external") {
    return {
      useKey,
      preferenceKind: "external",
      spaceId: null,
      externalLocation: externalDraft.trim() || null,
    };
  }
  if (raw.startsWith("space:")) {
    return {
      useKey,
      preferenceKind: "venue_space",
      spaceId: raw.slice("space:".length),
      externalLocation: null,
    };
  }
  return { useKey, preferenceKind: "undecided", spaceId: null, externalLocation: null };
}

/**
 * Compact Lead header: which candidate uses apply, and WHERE for those that do.
 * Multi-mode only, relevant configured uses for this event type.
 * Single-mode / no relevant uses uses EventSpaceField separately.
 */
export function LeadSpacePreferenceFields({
  leadId,
  spaces,
  spaceOperatingMode,
  eventType,
  initial,
  assignments = [],
  readOnly = false,
  onOccupancyAnchorChange,
}: {
  leadId: string;
  spaces: VenueSpace[];
  spaceOperatingMode: SpaceOperatingMode;
  eventType?: string | null;
  initial: LeadEventSpacePreference[];
  assignments?: LeadSpaceAssignmentDisplay[];
  readOnly?: boolean;
  onOccupancyAnchorChange?: (spaceId: string | null) => void;
}) {
  const profile = resolveExperienceProfile(eventType);
  const relevant = React.useMemo(
    () => relevantUsesForExperience(spaces, profile),
    [spaces, profile, eventType],
  );
  const [prefs, setPrefs] = React.useState<LeadEventSpacePreference[]>(() =>
    relevant.map((use) => initial.find((p) => p.useKey === use.key) ?? missingPref(use.key)),
  );
  const [pending, startTransition] = React.useTransition();
  const relevantKey = relevant.map((use) => use.key).join(",");

  React.useEffect(() => {
    setPrefs(relevant.map((use) => initial.find((p) => p.useKey === use.key) ?? missingPref(use.key)));
    // relevantKey tracks the use list; initial is the server snapshot for this lead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, relevantKey]);

  if (spaceOperatingMode !== "multi") return null;

  if (readOnly) {
    const assigned = assignments.filter((a) => a.useKey !== "event_space" && a.spaceName.trim());
    if (assigned.length === 0) return null;
    return (
      <div className="w-full min-w-0">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Space preferences
        </p>
        <div
          className="flex flex-wrap gap-x-4 gap-y-2"
          data-testid="space-preference-grid"
        >
          {assigned.map((a) => (
            <ReadOnlyColumn
              key={`${a.useKey}:${a.spaceName}`}
              label={labelForUseKey(a.useKey, a.useLabel)}
              value={a.spaceName}
            />
          ))}
        </div>
      </div>
    );
  }

  if (relevant.length === 0) return null;

  function persist(next: LeadEventSpacePreference[]) {
    const allowedUseKeys = relevant.map((use) => use.key);
    if (next.some((input) => !normalizeLeadSpacePreference(input, { allowedUseKeys, profile }).ok)) {
      return;
    }
    onOccupancyAnchorChange?.(occupancyAnchorSpaceIdFromPreferences(next, {
      weddingFamily: profile.isWeddingSpecific,
      relevantUseKeys: allowedUseKeys,
    }));
    startTransition(async () => {
      const result = await saveLeadSpacePreferencesAction(leadId, next);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save space preferences.");
        return;
      }
      toast.success("Space preferences saved.");
    });
  }

  const applicableCount = prefs.filter((p) => isApplicableLeadSpacePreferenceKind(p.preferenceKind)).length;

  return (
    <div className="w-full min-w-0">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Space preferences
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        Which parts of the event are taking place at your venue?
      </p>
      <div
        className="grid w-full min-w-0 grid-cols-1 items-start gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="space-preference-grid"
        data-applicable-count={applicableCount}
      >
        {relevant.map((use) => {
          const value = prefs.find((p) => p.useKey === use.key) ?? missingPref(use.key);
          const applicable = isApplicableLeadSpacePreferenceKind(value.preferenceKind);
          return (
            <div
              key={use.key}
              className="min-w-0"
              data-testid={`space-pref-row-${use.key}`}
              data-applicable={applicable ? "true" : "false"}
            >
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 rounded border-border"
                  checked={applicable}
                  disabled={pending}
                  data-testid={`space-pref-applicable-${use.key}`}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const nextPref: LeadEventSpacePreference = checked
                      ? {
                          useKey: use.key,
                          preferenceKind: "undecided",
                          spaceId: null,
                          externalLocation: null,
                        }
                      : {
                          useKey: use.key,
                          preferenceKind: "not_applicable",
                          spaceId: null,
                          externalLocation: null,
                        };
                    const next = relevant.map((u) =>
                      u.key === nextPref.useKey
                        ? nextPref
                        : prefs.find((p) => p.useKey === u.key) ?? missingPref(u.key),
                    );
                    setPrefs(next);
                    persist(next);
                  }}
                />
                <span className="min-w-0 truncate">{use.label}</span>
              </label>
              {applicable && (
                <div className="mt-1.5 min-w-0">
                  <PreferenceSpaceControl
                    value={value}
                    spaces={spacesEligibleForUse(spaces, use.key)}
                    allowExternal={allowsExternalLocation(use.key, profile)}
                    disabled={pending}
                    onChange={(nextPref) => {
                      const next = relevant.map((u) =>
                        u.key === nextPref.useKey
                          ? nextPref
                          : prefs.find((p) => p.useKey === u.key) ?? missingPref(u.key),
                      );
                      setPrefs(next);
                      persist(next);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadOnlyColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function PreferenceSpaceControl({
  value,
  spaces,
  allowExternal,
  disabled,
  onChange,
}: {
  value: LeadEventSpacePreference;
  spaces: VenueSpace[];
  allowExternal: boolean;
  disabled: boolean;
  onChange: (next: LeadEventSpacePreference) => void;
}) {
  const [externalDraft, setExternalDraft] = React.useState(value.externalLocation ?? "");
  React.useEffect(() => {
    setExternalDraft(value.externalLocation ?? "");
  }, [value.externalLocation]);

  // Space selector only — never includes a not-applicable option.
  const items = [
    { value: "undecided", label: "Not decided yet" },
    ...spaces.map((s) => ({
      value: `space:${s.id}`,
      label: s.name,
    })),
    ...(allowExternal ? [{ value: "external", label: "Outside the venue" }] : []),
  ];

  const selectValue = preferenceSelectValue(value);

  return (
    <div className="min-w-0 space-y-1">
      <Select
        value={selectValue}
        onValueChange={(raw) => {
          const next = preferenceFromSelectValue(value.useKey, raw, externalDraft);
          if (next.preferenceKind === "external" && !next.externalLocation) {
            onChange({ ...next, externalLocation: null });
            return;
          }
          onChange(next);
        }}
        items={items}
      >
        <SelectTrigger id={`pref-${value.useKey}`} disabled={disabled} className="font-medium">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {allowExternal && value.preferenceKind === "external" && (
        <Input
          id={`pref-ext-${value.useKey}`}
          value={externalDraft}
          placeholder="Location name"
          disabled={disabled}
          onChange={(e) => setExternalDraft(e.target.value)}
          onBlur={() => {
            const trimmed = externalDraft.trim();
            if (!trimmed) return;
            if (trimmed === (value.externalLocation ?? "")) return;
            onChange({
              useKey: value.useKey,
              preferenceKind: "external",
              spaceId: null,
              externalLocation: trimmed,
            });
          }}
        />
      )}
    </div>
  );
}

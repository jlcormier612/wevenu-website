"use client";

import * as React from "react";

import { toast } from "sonner";

import { saveLeadSpacePreferencesAction } from "@/app/(app)/leads/[id]/actions";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { VenueSpace } from "@/lib/availability/types";
import { ADDITIONAL_EVENT_SPACES_EXCLUDED_USE_KEYS } from "@/lib/contracts/event-spaces-merge";
import type { LeadEventSpacePreference, LeadSpacePreferenceUseKey } from "@/lib/leads/space-preferences";
import {
  normalizeLeadSpacePreference,
  occupancyAnchorSpaceIdFromPreferences,
  shouldShowLeadSpacePreference,
} from "@/lib/leads/space-preferences";
import { spacesEligibleForUse } from "@/lib/venue-spaces/assignments";
import type { SpaceOperatingMode } from "@/lib/venue-spaces/uses";
import { labelForUseKey } from "@/lib/venue-spaces/uses";

function emptyPref(useKey: LeadSpacePreferenceUseKey): LeadEventSpacePreference {
  return { useKey, preferenceKind: "undecided", spaceId: null, externalLocation: null };
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
  useKey: LeadSpacePreferenceUseKey,
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
 * Compact Lead header: WHERE is this event taking place?
 * Multi-mode only. Single-mode uses EventSpaceField separately.
 */
export function LeadSpacePreferenceFields({
  leadId,
  spaces,
  spaceOperatingMode,
  initial,
  assignments = [],
  readOnly = false,
  onOccupancyAnchorChange,
}: {
  leadId: string;
  spaces: VenueSpace[];
  spaceOperatingMode: SpaceOperatingMode;
  initial: LeadEventSpacePreference[];
  /** Booked-event residual + ceremony/reception from event_space_assignments. */
  assignments?: LeadSpaceAssignmentDisplay[];
  readOnly?: boolean;
  onOccupancyAnchorChange?: (spaceId: string | null) => void;
}) {
  const showCeremony = shouldShowLeadSpacePreference(spaceOperatingMode, spaces, "ceremony");
  const showReception = shouldShowLeadSpacePreference(spaceOperatingMode, spaces, "reception");
  const [ceremony, setCeremony] = React.useState(
    initial.find((p) => p.useKey === "ceremony") ?? emptyPref("ceremony"),
  );
  const [reception, setReception] = React.useState(
    initial.find((p) => p.useKey === "reception") ?? emptyPref("reception"),
  );
  const [pending, startTransition] = React.useTransition();

  const assignmentCeremony = assignments.find((a) => a.useKey === "ceremony");
  const assignmentReception = assignments.find((a) => a.useKey === "reception");
  const additional = assignments.filter(
    (a) => !ADDITIONAL_EVENT_SPACES_EXCLUDED_USE_KEYS.has(a.useKey.trim()),
  );

  const showCeremonyCol = readOnly ? Boolean(assignmentCeremony) : showCeremony;
  const showReceptionCol = readOnly ? Boolean(assignmentReception) : showReception;
  const showAdditional = additional.length > 0;

  if (!showCeremonyCol && !showReceptionCol && !showAdditional) return null;

  function persist(nextCeremony: LeadEventSpacePreference, nextReception: LeadEventSpacePreference) {
    const inputs = [
      ...(showCeremony ? [nextCeremony] : []),
      ...(showReception ? [nextReception] : []),
    ];
    if (inputs.some((input) => !normalizeLeadSpacePreference(input).ok)) return;
    onOccupancyAnchorChange?.(occupancyAnchorSpaceIdFromPreferences(inputs));
    startTransition(async () => {
      const result = await saveLeadSpacePreferencesAction(leadId, inputs);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save space preferences.");
        return;
      }
      toast.success("Space preferences saved.");
    });
  }

  return (
    <div className="w-full max-w-xl">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Space preferences
      </p>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {showCeremonyCol && (
          readOnly && assignmentCeremony ? (
            <ReadOnlyColumn label="Ceremony" value={assignmentCeremony.spaceName} />
          ) : (
            <PreferenceColumn
              label="Ceremony"
              value={ceremony}
              spaces={spacesEligibleForUse(spaces, "ceremony")}
              disabled={pending}
              onChange={(next) => {
                setCeremony(next);
                persist(next, reception);
              }}
            />
          )
        )}
        {showReceptionCol && (
          readOnly && assignmentReception ? (
            <ReadOnlyColumn label="Reception" value={assignmentReception.spaceName} />
          ) : (
            <PreferenceColumn
              label="Reception"
              value={reception}
              spaces={spacesEligibleForUse(spaces, "reception")}
              disabled={pending}
              onChange={(next) => {
                setReception(next);
                persist(ceremony, next);
              }}
            />
          )
        )}
        {showAdditional && (
          <div className="min-w-[7.5rem] max-w-[12rem]">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Additional
            </p>
            <ul className="mt-1 space-y-0.5">
              {additional.map((a) => (
                <li key={`${a.useKey}:${a.spaceName}`} className="text-sm font-medium text-foreground leading-snug">
                  {a.spaceName}
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {labelForUseKey(a.useKey, a.useLabel)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadOnlyColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[7.5rem]">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function PreferenceColumn({
  label,
  value,
  spaces,
  disabled,
  onChange,
}: {
  label: string;
  value: LeadEventSpacePreference;
  spaces: VenueSpace[];
  disabled: boolean;
  onChange: (next: LeadEventSpacePreference) => void;
}) {
  const [externalDraft, setExternalDraft] = React.useState(value.externalLocation ?? "");
  React.useEffect(() => {
    setExternalDraft(value.externalLocation ?? "");
  }, [value.externalLocation]);

  const items = [
    { value: "undecided", label: "Not decided yet" },
    ...spaces.map((s) => ({
      value: `space:${s.id}`,
      label: s.name,
    })),
    { value: "external", label: "Outside the venue" },
  ];

  const selectValue = preferenceSelectValue(value);

  return (
    <div className="min-w-[8.5rem] max-w-[14rem] space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <Select
        value={selectValue}
        onValueChange={(raw) => {
          const next = preferenceFromSelectValue(value.useKey, raw, externalDraft);
          // External without a name yet — keep draft editable; persist on blur.
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
      {value.preferenceKind === "external" && (
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

"use client";

import * as React from "react";

import { toast } from "sonner";

import { saveLeadSpacePreferencesAction } from "@/app/(app)/leads/[id]/actions";
import { Field } from "@/components/setup/field";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { VenueSpace } from "@/lib/availability/types";
import type { LeadEventSpacePreference, LeadSpacePreferenceUseKey } from "@/lib/leads/space-preferences";
import { normalizeLeadSpacePreference, shouldShowLeadSpacePreference } from "@/lib/leads/space-preferences";
import { spacesEligibleForUse } from "@/lib/venue-spaces/assignments";
import type { SpaceOperatingMode } from "@/lib/venue-spaces/uses";

const KIND_ITEMS = [
  { value: "undecided", label: "Not decided yet" },
  { value: "venue_space", label: "Venue space" },
  { value: "external", label: "Outside the venue" },
];

function emptyPref(useKey: LeadSpacePreferenceUseKey): LeadEventSpacePreference {
  return { useKey, preferenceKind: "undecided", spaceId: null, externalLocation: null };
}

export function LeadSpacePreferenceFields({
  leadId,
  spaces,
  spaceOperatingMode,
  initial,
}: {
  leadId: string;
  spaces: VenueSpace[];
  spaceOperatingMode: SpaceOperatingMode;
  initial: LeadEventSpacePreference[];
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

  if (!showCeremony && !showReception) return null;

  function persist(nextCeremony: LeadEventSpacePreference, nextReception: LeadEventSpacePreference) {
    const inputs = [
      ...(showCeremony ? [nextCeremony] : []),
      ...(showReception ? [nextReception] : []),
    ];
    if (inputs.some((input) => !normalizeLeadSpacePreference(input).ok)) return;
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
    <div className="w-full min-w-56 space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Space preferences
      </p>
      {showCeremony && (
        <PreferenceRow
          label="Ceremony"
          value={ceremony}
          spaces={spacesEligibleForUse(spaces, "ceremony")}
          disabled={pending}
          onChange={(next) => {
            setCeremony(next);
            persist(next, reception);
          }}
        />
      )}
      {showReception && (
        <PreferenceRow
          label="Reception"
          value={reception}
          spaces={spacesEligibleForUse(spaces, "reception")}
          disabled={pending}
          onChange={(next) => {
            setReception(next);
            persist(ceremony, next);
          }}
        />
      )}
    </div>
  );
}

function PreferenceRow({
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

  const spaceItems = spaces.map((s) => ({
    value: s.id,
    label: `${s.name}${s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}`,
  }));

  return (
    <div className="space-y-2">
      <Field label={label} htmlFor={`pref-kind-${value.useKey}`}>
        <Select
          value={value.preferenceKind}
          onValueChange={(kind) => {
            if (kind === "venue_space") {
              onChange({
                useKey: value.useKey,
                preferenceKind: "venue_space",
                spaceId: value.spaceId ?? spaces[0]?.id ?? "",
                externalLocation: null,
              });
              return;
            }
            if (kind === "external") {
              onChange({
                useKey: value.useKey,
                preferenceKind: "external",
                spaceId: null,
                externalLocation: externalDraft.trim() || null,
              });
              return;
            }
            onChange({ useKey: value.useKey, preferenceKind: "undecided", spaceId: null, externalLocation: null });
          }}
          items={KIND_ITEMS}
        >
          <SelectTrigger id={`pref-kind-${value.useKey}`} disabled={disabled}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {value.preferenceKind === "venue_space" && (
        <Select
          value={value.spaceId ?? ""}
          onValueChange={(spaceId) => onChange({
            useKey: value.useKey,
            preferenceKind: "venue_space",
            spaceId,
            externalLocation: null,
          })}
          items={spaceItems}
        >
          <SelectTrigger id={`pref-space-${value.useKey}`} disabled={disabled}>
            <SelectValue placeholder="Select a space" />
          </SelectTrigger>
          <SelectContent>
            {spaces.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
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

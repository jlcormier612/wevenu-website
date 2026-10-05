"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteSetupProfileAction,
  saveSetupProfileAction,
} from "@/app/(app)/settings/leads/setup-profiles/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  serializeTemplateRefs,
  setupProfileUsedForLabel,
  type SetupProfileAssignment,
  type SetupTemplateRefs,
  type VenueSetupProfile,
} from "@/lib/event-setup/profile";
import type { SetupProfileUsedForOption } from "@/lib/event-setup/setup-profile-event-types";
import {
  setupStepLabel,
  type SetupDecision,
  type SetupDecisions,
  type SetupStepKey,
} from "@/lib/event-setup/state";

type NamedOption = { id: string; name: string };

type Draft = {
  id: string | null;
  name: string;
  decisions: SetupDecisions;
  refs: SetupTemplateRefs;
  eventTypes: string[];
  venueDefault: boolean;
};

function emptyDraft(steps: SetupStepKey[]): Draft {
  const decisions: SetupDecisions = {};
  for (const step of steps) {
    if (step === "portal") continue;
    decisions[step] = undefined;
  }
  return {
    id: null,
    name: "",
    decisions,
    refs: {},
    eventTypes: [],
    venueDefault: false,
  };
}

function toggleId(list: string[] | undefined, id: string): string[] {
  const current = list ?? [];
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function nameFor(id: string | null | undefined, options: NamedOption[], empty: string): string {
  if (!id) return empty;
  return options.find((option) => option.id === id)?.name ?? id;
}

function profileSummary(
  profile: VenueSetupProfile,
  playbooks: NamedOption[],
  timelines: NamedOption[],
): string {
  const included = Object.entries(profile.decisions)
    .filter(([, value]) => value === "set_up")
    .map(([key]) => setupStepLabel(key as SetupStepKey));
  const refs = profile.templateRefs;
  const bits: string[] = [];
  if (included.length) bits.push(`Included: ${included.join(", ")}`);
  if (profile.decisions.planning === "set_up") {
    bits.push(`Planning: ${nameFor(refs.planningPlaybookTemplateId, playbooks, "no checklist")}`);
  }
  if (profile.decisions.timeline === "set_up") {
    bits.push(`Timeline: ${nameFor(refs.timelineTemplateId, timelines, "no default")}`);
  }
  return bits.join(" · ") || "No areas included yet";
}

export function SetupProfilesSection({
  canEdit,
  steps,
  profiles,
  assignments,
  usedForOptions,
  playbooks,
  timelines,
  floorPlans,
  vendors,
  questionnaires,
  inventoryTemplates,
  eventOrderTemplates,
}: {
  canEdit: boolean;
  steps: SetupStepKey[];
  profiles: VenueSetupProfile[];
  assignments: SetupProfileAssignment[];
  usedForOptions: SetupProfileUsedForOption[];
  playbooks: NamedOption[];
  timelines: NamedOption[];
  floorPlans: NamedOption[];
  vendors: NamedOption[];
  questionnaires: NamedOption[];
  inventoryTemplates: NamedOption[];
  eventOrderTemplates: NamedOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const decisionSteps = steps.filter((step) => step !== "portal");

  function beginCreate() {
    setDraft(emptyDraft(decisionSteps));
  }

  function beginEdit(profile: VenueSetupProfile) {
    const mine = assignments.filter((row) => row.profileId === profile.id);
    const acceptedKeys = new Set(usedForOptions.map((opt) => opt.value));
    setDraft({
      id: profile.id,
      name: profile.name,
      decisions: { ...profile.decisions },
      refs: serializeTemplateRefs(profile.templateRefs),
      eventTypes: mine
        .map((row) => row.eventType)
        .filter((type): type is string => typeof type === "string" && acceptedKeys.has(type)),
      venueDefault: mine.some((row) => row.eventType == null),
    });
  }

  function setDecision(step: SetupStepKey, decision: SetupDecision) {
    setDraft((current) => current ? { ...current, decisions: { ...current.decisions, [step]: decision } } : current);
  }

  function patchRefs(patch: Partial<SetupTemplateRefs>) {
    setDraft((current) => current ? { ...current, refs: { ...current.refs, ...patch } } : current);
  }

  function toggleType(value: string) {
    setDraft((current) => {
      if (!current) return current;
      const has = current.eventTypes.includes(value);
      return {
        ...current,
        eventTypes: has ? current.eventTypes.filter((type) => type !== value) : [...current.eventTypes, value],
      };
    });
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const result = await saveSetupProfileAction({
        id: draft.id,
        name: draft.name,
        decisions: draft.decisions,
        templateRefs: serializeTemplateRefs(draft.refs),
        eventTypes: draft.eventTypes,
        venueDefault: draft.venueDefault,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Setup profile saved.");
      setDraft(null);
      router.refresh();
    });
  }

  function remove(profileId: string) {
    if (!window.confirm("Delete this setup profile? Events that already inherited it keep their setup.")) return;
    startTransition(async () => {
      const result = await deleteSetupProfileAction(profileId);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success("Setup profile deleted.");
        setDraft(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          A Setup Profile is how this venue normally starts an event of this type — included capabilities and starting defaults. It is not the couple&apos;s later selections.
        </p>
        {canEdit && !draft ? (
          <Button type="button" onClick={beginCreate}>New setup profile</Button>
        ) : null}
      </div>

      <ul className="space-y-3">
        {profiles.length === 0 ? (
          <li className="text-sm text-muted-foreground">No setup profiles yet.</li>
        ) : profiles.map((profile) => {
          const usedFor = assignments.filter((row) => row.profileId === profile.id).map((row) => row.eventType);
          return (
            <li key={profile.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-heading">{profile.name}</p>
                <p className="text-sm text-muted-foreground">Used for: {setupProfileUsedForLabel(usedFor)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{profileSummary(profile, playbooks, timelines)}</p>
              </div>
              {canEdit ? (
                <Button type="button" variant="outline" size="sm" onClick={() => beginEdit(profile)}>Edit</Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {draft ? (
        <form
          className="space-y-5 rounded-lg border border-border px-4 py-4"
          onSubmit={(event) => { event.preventDefault(); save(); }}
        >
          <div className="space-y-1">
            <label className="text-sm font-medium text-heading" htmlFor="setup-profile-name">Name</label>
            <Input
              id="setup-profile-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Standard Wedding Setup"
            />
          </div>

          <div className="rounded-lg border border-border px-3 py-3">
            <p className="text-sm font-medium text-heading">Client portal</p>
            <p className="mt-1 text-sm text-muted-foreground">Always included. Planning experiences for this event type run in the client workspace. The portal cannot be skipped.</p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-heading">Capabilities</legend>
            <p className="text-xs text-muted-foreground">Included means this is part of the normal workflow. Defaults are starting intent, not completed work.</p>
            <ul className="space-y-3">
              {decisionSteps.map((step) => {
                const included = draft.decisions[step] === "set_up";
                return (
                  <li key={step} className="rounded-lg border border-border px-3 py-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-heading">{setupStepLabel(step)}</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={included ? "default" : "outline"}
                          onClick={() => setDecision(step, "set_up")}
                        >
                          Included
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={draft.decisions[step] === "skipped" ? "default" : "outline"}
                          onClick={() => setDecision(step, "skipped")}
                        >
                          Not included
                        </Button>
                      </div>
                    </div>
                    {included ? (
                      <CapabilityDefaults
                        step={step}
                        refs={draft.refs}
                        patchRefs={patchRefs}
                        playbooks={playbooks}
                        timelines={timelines}
                        floorPlans={floorPlans}
                        vendors={vendors}
                        questionnaires={questionnaires}
                        inventoryTemplates={inventoryTemplates}
                        eventOrderTemplates={eventOrderTemplates}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <fieldset className="space-y-2" data-testid="setup-profile-used-for">
            <legend className="text-sm font-medium text-heading">Used for</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.venueDefault}
                onChange={(event) => setDraft({ ...draft, venueDefault: event.target.checked })}
                data-testid="setup-profile-venue-default"
              />
              Venue default, when the event type has no profile of its own
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {usedForOptions.map((type) => (
                <label key={type.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.eventTypes.includes(type.value)}
                    onChange={() => toggleType(type.value)}
                    data-event-type={type.value}
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>Save setup profile</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDraft(null)}>Cancel</Button>
            {draft.id ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => remove(draft.id!)}>Delete</Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

function CapabilityDefaults({
  step,
  refs,
  patchRefs,
  playbooks,
  timelines,
  floorPlans,
  vendors,
  questionnaires,
  inventoryTemplates,
  eventOrderTemplates,
}: {
  step: SetupStepKey;
  refs: SetupTemplateRefs;
  patchRefs: (patch: Partial<SetupTemplateRefs>) => void;
  playbooks: NamedOption[];
  timelines: NamedOption[];
  floorPlans: NamedOption[];
  vendors: NamedOption[];
  questionnaires: NamedOption[];
  inventoryTemplates: NamedOption[];
  eventOrderTemplates: NamedOption[];
}) {
  if (step === "planning") {
    return (
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-heading">Default planning checklist</span>
        <select
          className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={refs.planningPlaybookTemplateId ?? ""}
          onChange={(event) => patchRefs({ planningPlaybookTemplateId: event.target.value || null })}
        >
          <option value="">None</option>
          {playbooks.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        <span className="block text-xs text-muted-foreground">Applied once to a new event when Planning is included.</span>
      </label>
    );
  }
  if (step === "timeline") {
    const extra = refs.timelineTemplateIds ?? [];
    return (
      <div className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-heading">Default timeline</span>
          <select
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={refs.timelineTemplateId ?? ""}
            onChange={(event) => patchRefs({ timelineTemplateId: event.target.value || null })}
          >
            <option value="">None</option>
            {timelines.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">Applied once when a new event has no timeline yet. Additional templates below are not merged automatically.</span>
        </label>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-heading">Additional available timelines</legend>
          {timelines.filter((option) => option.id !== refs.timelineTemplateId).map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={extra.includes(option.id)}
                onChange={() => patchRefs({ timelineTemplateIds: toggleId(extra, option.id) })}
              />
              {option.name}
            </label>
          ))}
        </fieldset>
      </div>
    );
  }
  if (step === "floor_plans") {
    const selected = refs.floorPlanTemplateIds ?? [];
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-heading">Starting floor-plan options</p>
        <p className="text-xs text-muted-foreground">These are default/available options. Booking does not create the event floor plan or offers.</p>
        {floorPlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No floor-plan templates in the library yet.</p>
        ) : floorPlans.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() => {
                const next = toggleId(selected, option.id);
                patchRefs({
                  floorPlanTemplateIds: next,
                  defaultFloorPlanTemplateId:
                    refs.defaultFloorPlanTemplateId && next.includes(refs.defaultFloorPlanTemplateId)
                      ? refs.defaultFloorPlanTemplateId
                      : null,
                });
              }}
            />
            {option.name}
          </label>
        ))}
        {selected.length > 0 ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-heading">Preferred starting plan</span>
            <select
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={refs.defaultFloorPlanTemplateId ?? ""}
              onChange={(event) => patchRefs({ defaultFloorPlanTemplateId: event.target.value || null })}
            >
              <option value="">None</option>
              {floorPlans.filter((option) => selected.includes(option.id)).map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    );
  }
  if (step === "vendors") {
    const required = refs.requiredVendorIds ?? [];
    const recommended = refs.recommendedVendorIds ?? [];
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">These are library references. Booking does not assign vendors or create recommendation rows.</p>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-heading">Required vendors</legend>
          {vendors.length === 0 ? <p className="text-sm text-muted-foreground">No vendors in the library yet.</p> : vendors.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={required.includes(option.id)}
                onChange={() => patchRefs({ requiredVendorIds: toggleId(required, option.id) })}
              />
              {option.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-heading">Working / recommended vendor list</legend>
          {vendors.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={recommended.includes(option.id)}
                onChange={() => patchRefs({ recommendedVendorIds: toggleId(recommended, option.id) })}
              />
              {option.name}
            </label>
          ))}
        </fieldset>
      </div>
    );
  }
  if (step === "questionnaires") {
    const selected = refs.questionnaireTemplateIds ?? [];
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-heading">Default questionnaires</p>
        <p className="text-xs text-muted-foreground">Venue default/reference only. Booking does not create or send questionnaires.</p>
        {questionnaires.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questionnaire templates yet.</p>
        ) : questionnaires.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() => patchRefs({ questionnaireTemplateIds: toggleId(selected, option.id) })}
            />
            {option.name}
          </label>
        ))}
      </div>
    );
  }
  if (step === "inventory") {
    return (
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-heading">Starting inventory offering</span>
        <select
          className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={refs.inventoryTemplateId ?? ""}
          onChange={(event) => patchRefs({ inventoryTemplateId: event.target.value || null })}
        >
          <option value="">No default inventory set</option>
          {inventoryTemplates.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        <span className="block text-xs text-muted-foreground">Reference only. Booking does not create event inventory or commit items.</span>
      </label>
    );
  }
  if (step === "event_order") {
    return (
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-heading">Starting event-order package</span>
        <select
          className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={refs.eventOrderTemplateId ?? ""}
          onChange={(event) => patchRefs({ eventOrderTemplateId: event.target.value || null })}
        >
          <option value="">No default event-order package</option>
          {eventOrderTemplates.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        <span className="block text-xs text-muted-foreground">Reference only. Booking does not start, send, or lock an event order.</span>
      </label>
    );
  }
  return null;
}

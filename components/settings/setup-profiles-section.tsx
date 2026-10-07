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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-2" data-testid="setup-profile-explanation">
          <p className="text-sm font-medium text-heading">Set up the client experience</p>
          <p className="text-sm text-muted-foreground">
            Choose what you want to have ready for your clients when you invite them into Hello to Cheers.
            These settings determine the tools, templates, and information that will be preset in their client portal.
          </p>
          <p className="text-sm text-muted-foreground">
            These are starting choices — you and your team can change or add more on any specific event later.
            They do not lock the client or your team into only what you pick here.
          </p>
          <p className="text-sm text-muted-foreground">
            Once you&apos;re happy with your setup, use <span className="font-medium text-heading">Invite to portal</span> from the client&apos;s event to invite them.
          </p>
        </div>
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

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-heading">What to include for this event type</legend>
            <p className="text-xs text-muted-foreground">
              Mark each area Included when it should be part of the normal starting experience for this event type.
              Defaults below are what gets ready for the client or your team — you can still change them on the event.
            </p>
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
        <span className="font-medium text-heading">Starting client planning checklist</span>
        <select
          className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={refs.planningPlaybookTemplateId ?? ""}
          onChange={(event) => patchRefs({ planningPlaybookTemplateId: event.target.value || null })}
          data-testid="setup-profile-default-planning"
        >
          <option value="">None</option>
          {playbooks.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        <span className="block text-xs text-muted-foreground">
          Applied once when a new event is booked. Your team can edit or release it to the client later.
          Options come from active Client Planning templates in your library.
        </span>
      </label>
    );
  }
  if (step === "timeline") {
    return (
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-heading">Starting timeline</span>
        <select
          className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={refs.timelineTemplateId ?? ""}
          onChange={(event) =>
            patchRefs({
              timelineTemplateId: event.target.value || null,
              timelineTemplateIds: [],
            })
          }
          data-testid="setup-profile-default-timeline"
        >
          <option value="">None</option>
          {timelines.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        <span className="block text-xs text-muted-foreground">
          Applied once when a new event has no timeline yet. Your team can edit it on the event afterward.
        </span>
      </label>
    );
  }
  if (step === "floor_plans") {
    const preferred = refs.defaultFloorPlanTemplateId ?? null;
    const selected = Array.from(new Set([
      ...(refs.floorPlanTemplateIds ?? []),
      ...(preferred ? [preferred] : []),
    ]));
    return (
      <div className="space-y-3" data-testid="setup-profile-floor-plans">
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-heading">Floor plans clients can choose from</legend>
          <p className="text-xs text-muted-foreground">
            Select every layout you want available in the client portal (for example Ceremony + Reception, Reception Only, Rain Plan).
            When the event is booked, these become the client&apos;s floor-plan options.
          </p>
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
                      preferred && next.includes(preferred) ? preferred : (next[0] ?? null),
                  });
                }}
              />
              {option.name}
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-heading">Preferred starting plan</span>
          <select
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={preferred ?? ""}
            onChange={(event) => {
              const id = event.target.value || null;
              const nextIds = id && !selected.includes(id) ? [...selected, id] : selected;
              patchRefs({
                defaultFloorPlanTemplateId: id,
                floorPlanTemplateIds: nextIds,
              });
            }}
            data-testid="setup-profile-default-floor-plan"
          >
            <option value="">None</option>
            {(selected.length ? floorPlans.filter((o) => selected.includes(o.id)) : floorPlans).map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">
            Shown first among the options. The client can still pick a different offered plan; your team can change the selection later.
          </span>
        </label>
      </div>
    );
  }
  if (step === "vendors") {
    const required = refs.requiredVendorIds ?? [];
    const recommended = refs.recommendedVendorIds ?? [];
    return (
      <div className="space-y-3" data-testid="setup-profile-vendors">
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-heading">Vendors your team expects to book</legend>
          <p className="text-xs text-muted-foreground">
            Library vendors your team typically needs for this event type. These are for your team&apos;s workflow —
            they are not assigned to the event automatically and are not shown to the client as recommendations.
          </p>
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
          <legend className="text-sm font-medium text-heading">Recommended vendors for the client</legend>
          <p className="text-xs text-muted-foreground">
            Vendors from your library to recommend to the client. When the event is booked, these appear as recommendations the client can review.
            Your team can add or remove recommendations on the event later.
          </p>
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
      <div className="space-y-1" data-testid="setup-profile-questionnaires">
        <p className="text-sm font-medium text-heading">Questionnaires to prepare for the client</p>
        <p className="text-xs text-muted-foreground">
          Choose which questionnaires should be prepared on the event when it is booked.
          They are set up as drafts for your team — nothing is emailed or shown in the client portal until you send them.
          You can select more than one (for example planning, final details, and post-event feedback).
        </p>
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
        <span className="block text-xs text-muted-foreground">
          Reminder for your team of the usual inventory starting point. Booking does not commit inventory to the event.
        </span>
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
        <span className="block text-xs text-muted-foreground">
          Reminder for your team of the usual package. Booking does not start or send an event order.
        </span>
      </label>
    );
  }
  return null;
}

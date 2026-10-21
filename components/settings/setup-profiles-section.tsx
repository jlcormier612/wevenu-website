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
import {
  profileConfigGaps,
  profileHardGapSummary,
  profileTemplateRefIncomplete,
} from "@/lib/event-setup/profile-config-gaps";
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
  return options.find((option) => option.id === id)?.name ?? empty;
}

/** Drop refs that are not in the current library option lists. */
function sanitizeRefsAgainstLibrary(
  refs: SetupTemplateRefs,
  library: {
    playbooks: NamedOption[];
    venuePlaybooks: NamedOption[];
    timelines: NamedOption[];
    floorPlans: NamedOption[];
    questionnaires: NamedOption[];
    vendors: NamedOption[];
    inventoryTemplates: NamedOption[];
    eventOrderTemplates: NamedOption[];
  },
): SetupTemplateRefs {
  const playbookIds = new Set(library.playbooks.map((o) => o.id));
  const venuePlaybookIds = new Set(library.venuePlaybooks.map((o) => o.id));
  const timelineIds = new Set(library.timelines.map((o) => o.id));
  const floorIds = new Set(library.floorPlans.map((o) => o.id));
  const questionnaireIds = new Set(library.questionnaires.map((o) => o.id));
  const vendorIds = new Set(library.vendors.map((o) => o.id));
  const inventoryIds = new Set(library.inventoryTemplates.map((o) => o.id));
  const eventOrderIds = new Set(library.eventOrderTemplates.map((o) => o.id));
  const planningId = refs.planningPlaybookTemplateId ?? null;
  const venuePlanningId = refs.venuePlanningPlaybookTemplateId ?? null;
  const timelineId = refs.timelineTemplateId ?? null;
  const preferredFloor = refs.defaultFloorPlanTemplateId ?? null;
  const floorPlanTemplateIds = (refs.floorPlanTemplateIds ?? []).filter((id) => floorIds.has(id));
  return {
    ...refs,
    planningPlaybookTemplateId: planningId && playbookIds.has(planningId) ? planningId : null,
    venuePlanningPlaybookTemplateId:
      venuePlanningId && venuePlaybookIds.has(venuePlanningId) ? venuePlanningId : null,
    timelineTemplateId: timelineId && timelineIds.has(timelineId) ? timelineId : null,
    timelineTemplateIds: (refs.timelineTemplateIds ?? []).filter((id) => timelineIds.has(id)),
    floorPlanTemplateIds,
    defaultFloorPlanTemplateId:
      preferredFloor && floorIds.has(preferredFloor) ? preferredFloor : null,
    questionnaireTemplateIds: (refs.questionnaireTemplateIds ?? []).filter((id) =>
      questionnaireIds.has(id),
    ),
    inventoryTemplateId:
      refs.inventoryTemplateId && inventoryIds.has(refs.inventoryTemplateId)
        ? refs.inventoryTemplateId
        : null,
    eventOrderTemplateId:
      refs.eventOrderTemplateId && eventOrderIds.has(refs.eventOrderTemplateId)
        ? refs.eventOrderTemplateId
        : null,
    // Dead Setup Profile requiredVendorIds — never persist; required vendors live in Vendor Network.
    requiredVendorIds: [],
    recommendedVendorIds: (refs.recommendedVendorIds ?? []).filter((id) => vendorIds.has(id)),
  };
}

function profileSummary(
  profile: VenueSetupProfile,
  playbooks: NamedOption[],
  venuePlaybooks: NamedOption[],
  timelines: NamedOption[],
): string {
  const included = Object.entries(profile.decisions)
    .filter(([, value]) => value === "set_up")
    .map(([key]) => setupStepLabel(key as SetupStepKey));
  const refs = profile.templateRefs;
  const bits: string[] = [];
  if (included.length) bits.push(`Included: ${included.join(", ")}`);
  if (profile.decisions.planning === "set_up") {
    bits.push(
      `Client checklist: ${nameFor(refs.planningPlaybookTemplateId, playbooks, "none")}`,
    );
    bits.push(
      `Venue checklist: ${nameFor(refs.venuePlanningPlaybookTemplateId, venuePlaybooks, "none")}`,
    );
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
  venuePlaybooks,
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
  venuePlaybooks: NamedOption[];
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
      refs: sanitizeRefsAgainstLibrary(serializeTemplateRefs(profile.templateRefs), {
        playbooks,
        venuePlaybooks,
        timelines,
        floorPlans,
        questionnaires,
        vendors,
        inventoryTemplates,
        eventOrderTemplates,
      }),
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
      const safeRefs = sanitizeRefsAgainstLibrary(serializeTemplateRefs(draft.refs), {
        playbooks,
        venuePlaybooks,
        timelines,
        floorPlans,
        questionnaires,
        vendors,
        inventoryTemplates,
        eventOrderTemplates,
      });
      const hardSummary = profileHardGapSummary(
        profileConfigGaps(draft.decisions, safeRefs, decisionSteps),
      );
      if (hardSummary) {
        toast.error(
          `${hardSummary} Mark the area Not included if you do not want Hello to Cheers to prepare it automatically.`,
        );
        return;
      }
      const result = await saveSetupProfileAction({
        id: draft.id,
        name: draft.name,
        decisions: draft.decisions,
        templateRefs: safeRefs,
        eventTypes: draft.eventTypes,
        venueDefault: draft.venueDefault,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Setup profile saved. New bookings apply this starting setup automatically.");
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
            Once you&apos;re happy with your setup, use{" "}
            <span className="font-medium text-heading">Invite client</span>
            {" "}
            from the client&apos;s event to invite them.
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
          const gaps = profileConfigGaps(profile.decisions, profile.templateRefs, decisionSteps);
          const hard = gaps.filter((g) => g.severity === "hard");
          return (
            <li key={profile.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-heading">{profile.name}</p>
                <p className="text-sm text-muted-foreground">Used for: {setupProfileUsedForLabel(usedFor)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{profileSummary(profile, playbooks, venuePlaybooks, timelines)}</p>
                {hard.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-800" data-testid="setup-profile-hard-gaps">
                    Incomplete — Included without a starting template: {hard.map((g) => setupStepLabel(g.step)).join(", ")}.
                    {" "}Edit to select templates or mark Not included. Existing events keep their current setup until you change them.
                  </p>
                ) : null}
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
                const incompleteRef =
                  ((step === "inventory" || step === "event_order")
                    && profileTemplateRefIncomplete(step, draft.decisions, draft.refs))
                  || (step === "planning"
                    && draft.decisions.planning === "set_up"
                    && (!draft.refs.planningPlaybookTemplateId
                      || !draft.refs.venuePlanningPlaybookTemplateId));
                return (
                  <li key={step} className="rounded-lg border border-border px-3 py-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-heading">{setupStepLabel(step)}</span>
                        {incompleteRef ? (
                          <span className="text-xs font-medium text-amber-800" data-testid={`setup-profile-${step}-incomplete`}>
                            Needs template
                          </span>
                        ) : null}
                      </div>
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
                        venuePlaybooks={venuePlaybooks}
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
  venuePlaybooks,
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
  venuePlaybooks: NamedOption[];
  timelines: NamedOption[];
  floorPlans: NamedOption[];
  vendors: NamedOption[];
  questionnaires: NamedOption[];
  inventoryTemplates: NamedOption[];
  eventOrderTemplates: NamedOption[];
}) {
  if (step === "planning") {
    return (
      <div className="space-y-4" data-testid="setup-profile-planning">
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
            Client Planning checklist and client task list. Applied once when a new event is booked.
            Options come from active Client Planning templates in your library.
          </span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-heading">Starting venue/internal planning checklist</span>
          <select
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={refs.venuePlanningPlaybookTemplateId ?? ""}
            onChange={(event) =>
              patchRefs({ venuePlanningPlaybookTemplateId: event.target.value || null })
            }
            data-testid="setup-profile-default-venue-planning"
          >
            <option value="">None</option>
            {venuePlaybooks.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">
            Venue Planning checklist and venue task list. Applied once at booking and stays internal —
            never released to the client portal. Options come from active Venue Planning templates.
          </span>
        </label>
      </div>
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
    return (
      <div className="space-y-4" data-testid="setup-profile-vendors">
        <div className="space-y-1">
          <p className="text-sm font-medium text-heading">Vendor Network</p>
          <p className="text-xs text-muted-foreground">
            Preferred, recommended, and required classifications in your Vendor Network are the
            source of truth. Eligible vendors are available for client discovery by default when
            you invite the client. You do not select a second recommendation list here.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-heading">Required vendors</p>
          <p className="text-xs text-muted-foreground">
            Required vendors keep their existing Vendor Network assignment behavior when an event
            is booked. Manage preferred, recommended, and required flags in Vendor Network — not
            in this Setup Profile.
          </p>
        </div>
        {vendors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vendors in the library yet.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {vendors.length} vendor{vendors.length === 1 ? "" : "s"} in your network are available
            according to their existing classifications.
          </p>
        )}
      </div>
    );
  }
  if (step === "questionnaires") {
    const selected = refs.questionnaireTemplateIds ?? [];
    return (
      <div className="space-y-1" data-testid="setup-profile-questionnaires">
        <p className="text-sm font-medium text-heading">Questionnaires for this event type</p>
        <p className="text-xs text-muted-foreground">
          Choose which questionnaires belong with this standard setup. They are prepared as drafts at booking
          for scheduled or explicitly authorized sends — Preparing and releasing the portal never sends them.
          Delivery timing stays in your questionnaires and communication workflow, separate from portal release and invitation.
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
    const selected = inventoryTemplates.find((option) => option.id === refs.inventoryTemplateId);
    const incomplete = !refs.inventoryTemplateId;
    return (
      <div className="space-y-1 text-sm" data-testid="setup-profile-inventory">
        <label className="block space-y-1">
          <span className="font-medium text-heading">Starting inventory offering</span>
          <select
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={refs.inventoryTemplateId ?? ""}
            onChange={(event) => patchRefs({ inventoryTemplateId: event.target.value || null })}
            aria-invalid={incomplete}
          >
            <option value="">Select a starting offering…</option>
            {inventoryTemplates.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </label>
        {incomplete ? (
          <p className="text-xs text-amber-800">
            Included but not configured — select a template, or mark Inventory Not included.
            Saving this profile never creates an inventory draft on existing events.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configured starting point: {selected?.name}. When a client is booked with this profile,
            the event inventory draft is prepared automatically from this offering. It is not shared
            with the couple and does not create invoices. Saving the profile does not change existing events.
          </p>
        )}
        {inventoryTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground">No inventory templates in your library yet.</p>
        ) : null}
      </div>
    );
  }
  if (step === "event_order") {
    const selected = eventOrderTemplates.find((option) => option.id === refs.eventOrderTemplateId);
    const incomplete = !refs.eventOrderTemplateId;
    return (
      <div className="space-y-1 text-sm" data-testid="setup-profile-event-order">
        <label className="block space-y-1">
          <span className="font-medium text-heading">Starting event-order package</span>
          <select
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={refs.eventOrderTemplateId ?? ""}
            onChange={(event) => patchRefs({ eventOrderTemplateId: event.target.value || null })}
            aria-invalid={incomplete}
          >
            <option value="">Select a starting package…</option>
            {eventOrderTemplates.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </label>
        {incomplete ? (
          <p className="text-xs text-amber-800">
            Included but not configured — select a package, or mark Event Order Not included (for package-only events).
            Saving this profile never creates an Event Order draft on existing events.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configured starting point: {selected?.name}. When a client is booked with this profile,
            the Event Order draft is prepared automatically from this package. It is not shared,
            not an invoice, and not a payment plan. Saving the profile does not change existing events.
          </p>
        )}
        {eventOrderTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground">No Event Order templates in your library yet.</p>
        ) : null}
      </div>
    );
  }
  return null;
}

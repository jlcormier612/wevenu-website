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
  setupProfileUsedForLabel,
  type SetupProfileAssignment,
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
  playbookId: string;
  timelineId: string;
  eventTypes: string[];
  venueDefault: boolean;
};

function emptyDraft(steps: SetupStepKey[]): Draft {
  const decisions: SetupDecisions = {};
  for (const step of steps) decisions[step] = undefined;
  return {
    id: null,
    name: "",
    decisions,
    playbookId: "",
    timelineId: "",
    eventTypes: [],
    venueDefault: false,
  };
}

export function SetupProfilesSection({
  canEdit,
  steps,
  profiles,
  assignments,
  usedForOptions,
  playbooks,
  timelines,
}: {
  canEdit: boolean;
  steps: SetupStepKey[];
  profiles: VenueSetupProfile[];
  assignments: SetupProfileAssignment[];
  /** Accepted event types ∩ catalog (wedding labeled All Weddings). */
  usedForOptions: SetupProfileUsedForOption[];
  playbooks: NamedOption[];
  timelines: NamedOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState<Draft | null>(null);

  function beginCreate() {
    setDraft(emptyDraft(steps));
  }

  function beginEdit(profile: VenueSetupProfile) {
    const mine = assignments.filter((row) => row.profileId === profile.id);
    const acceptedKeys = new Set(usedForOptions.map((opt) => opt.value));
    setDraft({
      id: profile.id,
      name: profile.name,
      decisions: { ...profile.decisions },
      playbookId: profile.templateRefs.planningPlaybookTemplateId ?? "",
      timelineId: profile.templateRefs.timelineTemplateId ?? "",
      eventTypes: mine
        .map((row) => row.eventType)
        .filter((type): type is string => typeof type === "string" && acceptedKeys.has(type)),
      venueDefault: mine.some((row) => row.eventType == null),
    });
  }

  function setDecision(step: SetupStepKey, decision: SetupDecision) {
    setDraft((current) => current ? { ...current, decisions: { ...current.decisions, [step]: decision } } : current);
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
        templateRefs: {
          planningPlaybookTemplateId: draft.playbookId || null,
          timelineTemplateId: draft.timelineId || null,
        },
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
          A Setup Profile is how this venue normally sets up an event. It is not a commercial package.
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
            <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-heading">{profile.name}</p>
                <p className="text-sm text-muted-foreground">Used for: {setupProfileUsedForLabel(usedFor)}</p>
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

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-heading">Areas</legend>
            <p className="text-xs text-muted-foreground">Choose configured or skipped. A feature existing does not decide this.</p>
            <ul className="space-y-2">
              {steps.map((step) => (
                <li key={step} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">{setupStepLabel(step)}</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={draft.decisions[step] === "set_up" ? "default" : "outline"}
                      onClick={() => setDecision(step, "set_up")}
                    >
                      Configured
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={draft.decisions[step] === "skipped" ? "default" : "outline"}
                      onClick={() => setDecision(step, "skipped")}
                    >
                      Skipped
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-heading">Planning checklist</span>
              <select
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={draft.playbookId}
                onChange={(event) => setDraft({ ...draft, playbookId: event.target.value })}
              >
                <option value="">None</option>
                {playbooks.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted-foreground">Applied once when a new event inherits Planning as configured.</span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-heading">Timeline template</span>
              <select
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={draft.timelineId}
                onChange={(event) => setDraft({ ...draft, timelineId: event.target.value })}
              >
                <option value="">None</option>
                {timelines.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted-foreground">Copied once when a new event inherits Timeline as configured.</span>
            </label>
          </div>

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

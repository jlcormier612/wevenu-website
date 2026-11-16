import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { confirmEventExperienceReviewAction } from "@/app/(app)/setup-hub/actions";
import { MarkExperienceReady } from "@/components/setup-hub/phase-b1/mark-experience-ready";
import { MilestoneDetailShell } from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSpaces } from "@/lib/availability/service";
import { profileHardGapSummary } from "@/lib/event-setup/profile-config-gaps";
import { getTemplates as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getTemplates as getPlaybookTemplates } from "@/lib/playbooks/service";
import { getTemplates as getQuestionnaireTemplates } from "@/lib/questionnaire-templates/service";
import {
  EXPERIENCE_FAMILY_COPY,
  EXPERIENCE_PREPARE_INTRO,
} from "@/lib/setup-hub/phase-b1-experience-copy";
import { experienceToolRows } from "@/lib/setup-hub/phase-b1-experience-resources";
import {
  effectiveHostedEventTypes,
  hostedEventTypeLabel,
  hostedEventTypeOption,
} from "@/lib/setup-hub/phase-b1-event-types";
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";
import {
  assignedProfileForEventType,
  assignedProfileHardGaps,
  canConfirmEventTypeReview,
  eventTypeReadiness,
  experienceFamilyDisplayStatus,
} from "@/lib/setup-hub/phase-b1-readiness";
import {
  experiencePrepareReturn,
  PHASE_B1_M02_ROUTES,
  setupProfileCreateHref,
  setupProfileReviewHref,
} from "@/lib/setup-hub/phase-b1-routes";
import { getTemplates as getTimelineTemplates } from "@/lib/timeline-templates/service";
import { getVendors } from "@/lib/vendors/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventType: string }>;
}): Promise<Metadata> {
  const { eventType } = await params;
  const option = hostedEventTypeOption(eventType);
  if (!option) return { title: "Prepare your event experience — Setup" };
  return { title: `${EXPERIENCE_FAMILY_COPY[option.value].pageHeading} — Setup` };
}

export default async function EventExperiencePreparePage({
  params,
}: {
  params: Promise<{ eventType: string }>;
}) {
  const { eventType: rawType } = await params;
  const option = hostedEventTypeOption(rawType);
  if (!option) notFound();

  const ctx = await loadMilestone02Context();
  if (!ctx) return null;

  const copy = EXPERIENCE_FAMILY_COPY[option.value];
  const selected = effectiveHostedEventTypes(ctx.hubState?.hostedEventTypes).includes(option.value);
  const profile = assignedProfileForEventType(option.value, ctx.assignments, ctx.profiles);
  const card = eventTypeReadiness({
    eventType: option.value,
    selected,
    assignments: ctx.assignments,
    profiles: ctx.profiles,
    reviews: ctx.hubState?.eventExperienceReviews ?? {},
  });
  const gate = canConfirmEventTypeReview({
    eventType: option.value,
    hostedEventTypes: ctx.hubState?.hostedEventTypes ?? null,
    assignments: ctx.assignments,
    profiles: ctx.profiles,
  });
  const assignedTypes = ctx.assignments
    .filter((row) => row.profileId === profile?.id && row.eventType)
    .map((row) => hostedEventTypeLabel(row.eventType!));
  const returnNav = experiencePrepareReturn(option.value, copy.pageHeading);
  const fullProfile = ctx.profiles.find((row) => row.id === profile?.id) ?? profile;

  async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  const [playbooks, timelines, floorPlans, questionnaires, vendors, spaces] = await Promise.all([
    safe(() => getPlaybookTemplates(), []),
    safe(() => getTimelineTemplates(), []),
    safe(() => getFloorPlanTemplates(), []),
    safe(() => getQuestionnaireTemplates(), []),
    safe(() => getVendors(), []),
    safe(() => getSpaces(), []),
  ]);

  const tools = fullProfile
    ? experienceToolRows({
        eventType: option.value,
        heading: copy.pageHeading,
        decisions: fullProfile.decisions ?? {},
        refs: fullProfile.templateRefs ?? {},
        playbooks: playbooks.map((row) => ({
          id: row.id,
          name: row.name,
          sourceMasterKey: row.sourceMasterKey,
        })),
        timelines: timelines.map((row) => ({
          id: row.id,
          name: row.name,
          sourceMasterKey: row.sourceMasterKey,
        })),
        floorPlans: floorPlans.map((row) => ({
          id: row.id,
          name: row.name,
          sourceMasterKey: row.sourceMasterKey,
        })),
        questionnaires: questionnaires.map((row) => ({
          id: row.id,
          name: row.name,
          sourceMasterKey: row.sourceMasterKey,
        })),
        vendors: vendors.map((row) => ({ id: row.id, name: row.businessName })),
        spaceCount: spaces.length,
      })
    : [];

  const includedTools = tools.filter((tool) => tool.inclusion === "Included");
  const attentionItems = [
    ...assignedProfileHardGaps(fullProfile ?? null).map((gap) => gap.message),
    ...tools.filter((tool) => tool.attention).map((tool) => tool.attention!),
  ];
  const configuredResources = includedTools.flatMap((tool) =>
    tool.resources.filter((row) => row.designation !== null && row.status !== "Needs attention"),
  );

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="02"
        title={copy.pageHeading}
        intro={EXPERIENCE_PREPARE_INTRO}
        statusLabel={experienceFamilyDisplayStatus(card)}
        backHref={PHASE_B1_M02_ROUTES.eventExperiences}
        backLabel="Back to Your event experiences"
      >
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Choose this event family on Your event experiences before preparing it.
          </p>
        ) : null}

        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold text-heading">Your starting point</h2>
          <p className="text-sm text-muted-foreground">
            A Setup Profile brings together the resources you want available for this type of event.
            We&apos;ll start with a prepared option that you can personalize.
          </p>
          {fullProfile ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                <span className="font-medium">{fullProfile.name}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Assigned event types: {assignedTypes.length > 0 ? assignedTypes.join(", ") : "None yet"}
              </p>
              <Button
                type="button"
                render={<Link href={setupProfileReviewHref(fullProfile.id, returnNav)} />}
              >
                Review setup
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Suggested name: {copy.suggestedName}
              </p>
              <Button
                type="button"
                render={<Link href={setupProfileCreateHref(option.value, returnNav)} />}
              >
                {copy.createAction}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold text-heading">Choose your planning tools</h2>
          <p className="text-sm text-muted-foreground">
            Select the tools you normally use for this type of event. We&apos;ll help you prepare the
            resources that go with them.
          </p>
          {fullProfile ? (
            <ul className="space-y-3">
              {tools.map((tool) => (
                <li key={tool.step} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{tool.title}</p>
                    <Badge variant="muted">{tool.inclusion}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Create a Setup Profile first to choose which planning tools are included.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold text-heading">Prepare your resources</h2>
          <p className="text-sm text-muted-foreground">
            Review the reusable resources you&apos;d like to start with. Our starters give you a head
            start, and you can customize them to fit your venue.
          </p>
          {fullProfile ? (
            <div className="space-y-4">
              {includedTools.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No planning tools are included yet. Included tools will appear here with their
                  resources.
                </p>
              ) : (
                includedTools.map((tool) => (
                  <div key={tool.step} className="space-y-2">
                    <h3 className="font-medium text-foreground">{tool.title}</h3>
                    {tool.attention ? (
                      <p className="text-xs text-muted-foreground">{tool.attention}</p>
                    ) : null}
                    <ul className="space-y-2">
                      {tool.resources.map((resource) => (
                        <li
                          key={`${tool.step}-${resource.id}`}
                          className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">{resource.name}</p>
                            <div className="flex flex-wrap gap-2">
                              {resource.designation ? (
                                <Badge variant="muted">{resource.designation}</Badge>
                              ) : null}
                              {resource.status ? (
                                <Badge variant="muted">{resource.status}</Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {resource.previewHref ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                render={<Link href={resource.previewHref} />}
                              >
                                Preview
                              </Button>
                            ) : null}
                            {resource.customizeHref ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                render={<Link href={resource.customizeHref} />}
                              >
                                Customize
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              render={<Link href={resource.manageHref} />}
                            >
                              Manage
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Create a Setup Profile first to prepare the resources for this experience.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold text-heading">Review your experience</h2>
          <p className="text-sm text-muted-foreground">
            Take a final look at what HTC will prepare when you create this type of event. Changes
            you make here update this reusable starting experience. Changes you make on an individual
            event stay with that event.
          </p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Event family</dt>
              <dd className="text-foreground">{copy.cardTitle}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Assigned Setup Profile</dt>
              <dd className="text-foreground">{fullProfile?.name ?? "None yet"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Included planning capabilities</dt>
              <dd className="text-foreground">
                {includedTools.length > 0
                  ? includedTools.map((tool) => tool.title).join(", ")
                  : "None selected"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Associated resources</dt>
              <dd className="text-foreground">
                {configuredResources.length > 0
                  ? configuredResources.map((row) => row.name).join(", ")
                  : "None configured yet"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Needs attention</dt>
              <dd className="text-foreground">
                {attentionItems.length > 0
                  ? attentionItems.join(" ")
                  : profileHardGapSummary(assignedProfileHardGaps(fullProfile ?? null)) ??
                    "Nothing required is outstanding."}
              </dd>
            </div>
          </dl>

          <MarkExperienceReady
            action={confirmEventExperienceReviewAction.bind(null, option.value)}
            canConfirm={gate.ok}
            disabledReason={gate.ok ? undefined : gate.message}
            alreadyReady={card.reason === "ready"}
          />
        </section>
      </MilestoneDetailShell>
    </div>
  );
}

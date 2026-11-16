import type { Metadata } from "next";
import Link from "next/link";

import { HostedEventTypesForm } from "@/components/setup-hub/phase-b1/hosted-event-types-form";
import { MilestoneDetailShell } from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { effectiveHostedEventTypes, HOSTED_EVENT_TYPE_OPTIONS } from "@/lib/setup-hub/phase-b1-event-types";
import { EXPERIENCE_FAMILY_COPY } from "@/lib/setup-hub/phase-b1-experience-copy";
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";
import {
  eventTypeReadiness,
  experienceFamilyDisplayStatus,
  SECTION_STATUS_LABEL,
} from "@/lib/setup-hub/phase-b1-readiness";
import { experiencePrepareHref, PHASE_B1_M02_ROUTES } from "@/lib/setup-hub/phase-b1-routes";

export const metadata: Metadata = { title: "Your event experiences — Setup" };
export const dynamic = "force-dynamic";

export default async function EventExperiencesSetupPage() {
  const ctx = await loadMilestone02Context();
  if (!ctx) return null;
  const selected = effectiveHostedEventTypes(ctx.hubState?.hostedEventTypes);

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="02"
        title="Your event experiences"
        intro="Choose the events you host and prepare the experience for each one."
        statusLabel={SECTION_STATUS_LABEL[ctx.sections.experiences]}
        backHref={PHASE_B1_M02_ROUTES.overview}
        backLabel="Back to Make HTC yours"
      >
        <HostedEventTypesForm initialTypes={selected} />

        {selected.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-medium text-heading">
                Let&apos;s prepare your event experiences.
              </h2>
              <p className="text-sm text-muted-foreground">
                We&apos;ll help you get the planning essentials ready for each type of event you host.
                Start with our prepared resources, make them your own, and come back whenever you
                need to.
              </p>
            </div>
            {HOSTED_EVENT_TYPE_OPTIONS.filter((option) => selected.includes(option.value)).map(
              (option) => {
                const copy = EXPERIENCE_FAMILY_COPY[option.value];
                const card = eventTypeReadiness({
                  eventType: option.value,
                  selected: true,
                  assignments: ctx.assignments,
                  profiles: ctx.profiles,
                  reviews: ctx.hubState?.eventExperienceReviews ?? {},
                });
                const status = experienceFamilyDisplayStatus(card);
                const actionLabel = card.profile ? copy.reviewAction : copy.prepareAction;

                return (
                  <section
                    key={option.value}
                    className="w-full space-y-3 rounded-xl border border-border bg-card p-5"
                    data-testid={`phase-b1-experience-${option.value}`}
                  >
                    <h3 className="font-heading text-lg font-medium text-heading">{copy.cardTitle}</h3>
                    <Badge variant="muted">{status}</Badge>
                    <p className="text-sm text-muted-foreground">{copy.cardDescription}</p>
                    <Button type="button" render={<Link href={experiencePrepareHref(option.value)} />}>
                      {actionLabel}
                    </Button>
                    {card.reason === "stale" ? (
                      <p className="text-xs text-muted-foreground">
                        This profile changed since you last confirmed it. Review it again before it
                        can be Ready.
                      </p>
                    ) : null}
                  </section>
                );
              },
            )}
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          You can bring existing booked events over while you continue preparing these experiences.
          Preparing an event experience is for future events — it isn&apos;t required before importing
          the bookings you already have.
        </p>
      </MilestoneDetailShell>
    </div>
  );
}

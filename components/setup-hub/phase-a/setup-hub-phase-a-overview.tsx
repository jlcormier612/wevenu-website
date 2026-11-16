import { PhaseAMilestoneCard } from "@/components/setup-hub/phase-a/milestone-card";
import {
  PhaseAFirstVisitWelcome,
  PhaseAReturningWelcome,
} from "@/components/setup-hub/phase-a/welcome-panel";
import {
  buildPhaseAMilestones,
  nextIncompleteMilestoneHref,
  phaseAProgressSummary,
  type PhaseAProgressInput,
} from "@/lib/setup-hub/phase-a-milestones";

const MILESTONES_HEADING_ID = "setup-journey-heading";

export function SetupHubPhaseAOverview(input: PhaseAProgressInput) {
  const milestones = buildPhaseAMilestones(input);
  const isFirstVisit = !input.hubState?.welcomeExploredAt;
  const continueHref = nextIncompleteMilestoneHref(milestones);
  const progressCopy = phaseAProgressSummary(milestones);

  return (
    <div className="mx-auto max-w-[960px] space-y-6" data-testid="phase-a-setup-hub">
      {isFirstVisit ? (
        <PhaseAFirstVisitWelcome milestonesHeadingId={MILESTONES_HEADING_ID} />
      ) : (
        <PhaseAReturningWelcome continueHref={continueHref} />
      )}

      <section className="space-y-4" aria-labelledby={MILESTONES_HEADING_ID}>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            YOUR SETUP JOURNEY
          </p>
          <h2
            id={MILESTONES_HEADING_ID}
            tabIndex={-1}
            className="scroll-mt-24 font-serif text-2xl font-semibold tracking-tight text-heading sm:text-3xl outline-none"
          >
            Make yourself at home.
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            Everything you need to feel ready, all in one place.
          </p>
        </div>

        <div
          className="rounded-xl border border-border bg-muted/20 px-4 py-3 sm:px-5"
          data-testid="phase-a-progress-panel"
        >
          <p className="text-sm font-semibold text-heading">Your progress</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll keep track of your progress as you prepare your venue.
          </p>
          <p className="mt-2 text-sm text-foreground" data-testid="phase-a-progress-summary">
            {progressCopy}
          </p>
        </div>

        <div className="space-y-4">
          {milestones.map((m) => (
            <PhaseAMilestoneCard key={m.key} milestone={m} />
          ))}
        </div>
      </section>
    </div>
  );
}

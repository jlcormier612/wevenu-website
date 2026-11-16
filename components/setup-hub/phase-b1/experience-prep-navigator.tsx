import type { ExperiencePreparationStatus } from "@/lib/setup-hub/phase-b1-readiness";

const STEPS = [
  { id: "experience-step-1", number: "1", title: "Your starting point" },
  { id: "experience-step-2", number: "2", title: "Choose your planning tools" },
  { id: "experience-step-3", number: "3", title: "Prepare your resources" },
  { id: "experience-step-4", number: "4", title: "Review your experience" },
] as const;

function stepStatus(
  stepNumber: string,
  prepStatus: ExperiencePreparationStatus,
): ExperiencePreparationStatus {
  if (prepStatus === "Ready") return "Ready";
  if (stepNumber === "4") return "Not reviewed";
  if (prepStatus === "Reviewed") return "Reviewed";
  return "Not reviewed";
}

export function ExperiencePrepNavigator({
  prepStatus,
}: {
  prepStatus: ExperiencePreparationStatus;
}) {
  return (
    <nav
      aria-label="Experience preparation steps"
      className="grid grid-cols-2 gap-2 md:grid-cols-4"
      data-testid="phase-b1-experience-navigator"
    >
      {STEPS.map((step) => {
        const status = stepStatus(step.number, prepStatus);
        return (
          <a
            key={step.id}
            href={`#${step.id}`}
            className="rounded-xl border border-border bg-muted/20 px-3 py-3 no-underline transition-colors hover:border-primary/30 hover:bg-muted/35"
            data-testid={`phase-b1-experience-nav-${step.number}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Step {step.number}
            </p>
            <p className="mt-1 text-sm font-medium text-heading">{step.title}</p>
            <p className="mt-1 text-xs text-muted-foreground" data-testid={`phase-b1-experience-nav-status-${step.number}`}>
              {status}
            </p>
          </a>
        );
      })}
    </nav>
  );
}

import type { OnboardingEngagementStatus } from "@/lib/hq/onboarding-types";

const STATUS_META: Record<OnboardingEngagementStatus, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-info/15 text-info" },
  paused:      { label: "Paused",      className: "bg-warning/15 text-warning" },
  blocked:     { label: "Blocked",     className: "bg-destructive/15 text-destructive" },
  complete:    { label: "Complete",    className: "bg-success/15 text-success" },
};

export function OnboardingStatusBadge({ status }: { status: OnboardingEngagementStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

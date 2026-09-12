import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EXPERIENCE_STATUS_LABEL } from "@/lib/document-workspace/experience";
import type { ExperienceStatus, WorkspaceCategory, WorkspaceStatus } from "@/lib/document-workspace/types";

const CATEGORY_VARIANT: Record<WorkspaceCategory, BadgeVariant> = {
  "Contracts":        "default",
  "Invoices":         "muted",
  "Questionnaires":   "accent",
  "Planning":         "accent",
  "Floor Plans":      "accent",
  "Wedding Website":  "muted",
  "Photos":           "muted",
  "Vendor Documents": "warning",
  "Financial":        "muted",
  "Communication":    "muted",
  "Exports":          "muted",
  "Other":            "muted",
};

export function WorkspaceCategoryBadge({ category }: { category: WorkspaceCategory }) {
  return <Badge variant={CATEGORY_VARIANT[category]}>{category}</Badge>;
}

const STATUS_META: Record<WorkspaceStatus, { label: string; variant: BadgeVariant } | null> = {
  action_needed: { label: "Needs attention", variant: "warning" },
  in_progress:   { label: "In Progress",      variant: "secondary" },
  complete:      { label: "Complete",         variant: "success" },
  none:          null,
};

const EXPERIENCE_VARIANT: Record<ExperienceStatus, BadgeVariant | null> = {
  draft: "secondary",
  in_progress: "secondary",
  with_someone: "accent",
  review: "warning",
  changes_requested: "warning",
  complete: "success",
  final: "success",
  none: null,
};

export function WorkspaceStatusBadge({
  status,
  experienceStatus,
}: {
  status: WorkspaceStatus;
  experienceStatus?: ExperienceStatus;
}) {
  if (experienceStatus && experienceStatus !== "none") {
    const variant = EXPERIENCE_VARIANT[experienceStatus];
    if (!variant) return null;
    return <Badge variant={variant}>{EXPERIENCE_STATUS_LABEL[experienceStatus]}</Badge>;
  }
  const meta = STATUS_META[status];
  if (!meta) return null;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

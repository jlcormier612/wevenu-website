import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { experienceBadgeLabel } from "@/lib/document-workspace/experience";
import type { ExperienceStatus, WorkspaceCategory, WorkspaceDocType, WorkspaceStatus } from "@/lib/document-workspace/types";

/** Quiet category chips use eucalyptus Active — not muted gray. */
const EUCALYPTUS_CATEGORIES = new Set<WorkspaceCategory>([
  "Contracts",
  "Invoices",
  "Planning",
  "Questionnaires",
  "Floor Plans",
  "Financial",
  "Photos",
  "Vendor Documents",
  "Communication",
  "Exports",
  "Wedding Website",
  "Other",
]);

export function WorkspaceCategoryBadge({ category }: { category: WorkspaceCategory }) {
  if (EUCALYPTUS_CATEGORIES.has(category)) {
    return <Badge className="htc-badge-active">{category}</Badge>;
  }
  return <Badge variant="outline">{category}</Badge>;
}

const STATUS_META: Record<WorkspaceStatus, { label: string; variant: BadgeVariant; active?: boolean } | null> = {
  action_needed: { label: "Needs attention", variant: "warning" },
  in_progress:   { label: "In Progress",      variant: "outline", active: true },
  complete:      { label: "Complete",         variant: "outline", active: true },
  none:          null,
};

const EXPERIENCE_VARIANT: Record<ExperienceStatus, { variant: BadgeVariant; active?: boolean } | null> = {
  draft: { variant: "outline", active: true },
  in_progress: { variant: "outline", active: true },
  with_someone: { variant: "accent" },
  review: { variant: "warning" },
  changes_requested: { variant: "warning" },
  complete: { variant: "outline", active: true },
  final: { variant: "outline", active: true },
  none: null,
};

export function WorkspaceStatusBadge({
  status,
  experienceStatus,
  docType,
}: {
  status: WorkspaceStatus;
  experienceStatus?: ExperienceStatus;
  docType?: WorkspaceDocType;
}) {
  if (experienceStatus && experienceStatus !== "none") {
    const meta = EXPERIENCE_VARIANT[experienceStatus];
    if (!meta) return null;
    return (
      <Badge
        variant={meta.variant}
        className={meta.active ? "htc-badge-active" : undefined}
      >
        {experienceBadgeLabel(experienceStatus, docType)}
      </Badge>
    );
  }
  const meta = STATUS_META[status];
  if (!meta) return null;
  return (
    <Badge
      variant={meta.variant}
      className={meta.active ? "htc-badge-active" : undefined}
    >
      {meta.label}
    </Badge>
  );
}

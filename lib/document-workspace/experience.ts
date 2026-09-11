/**
 * Human-facing Documents experience labels.
 * These are presentation concepts — not a universal database enum.
 */
import type {
  ExperienceStatus,
  NextActor,
  WorkspaceDocType,
  WorkspaceStatus,
} from "@/lib/document-workspace/types";

export type { ExperienceStatus, NextActor };

export const EXPERIENCE_STATUS_LABEL: Record<ExperienceStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  with_someone: "With Someone",
  review: "Review",
  changes_requested: "Changes Requested",
  complete: "Complete",
  final: "Final",
  none: "",
};

export type ExperienceView = {
  experienceStatus: ExperienceStatus;
  nextActor: NextActor;
  nextActionLabel: string | null;
  filterStatus: WorkspaceStatus;
  producerHref: string | null;
  artifactAuthority: "producer_final" | "uploaded_file" | "working_record";
};

function coupleNameSuffix(relationshipName: string | null): string {
  return relationshipName ? "Couple" : "Client";
}

export function describeExperience(input: {
  docType: WorkspaceDocType;
  rawStatus: string | null;
  eventId: string | null;
  id: string;
  isCompanionUpload?: boolean;
  hasFinalArtifact?: boolean;
  relationshipName?: string | null;
}): ExperienceView {
  const who = coupleNameSuffix(input.relationshipName ?? null);

  if (input.docType === "document") {
    return {
      experienceStatus: "none",
      nextActor: null,
      nextActionLabel: null,
      filterStatus: "none",
      producerHref: null,
      artifactAuthority: input.isCompanionUpload ? "uploaded_file" : "uploaded_file",
    };
  }

  if (input.docType === "floor_plan") {
    return {
      experienceStatus: "none",
      nextActor: null,
      nextActionLabel: null,
      filterStatus: "none",
      producerHref: input.eventId ? `/events/${input.eventId}/floor-plans/${input.id}` : null,
      artifactAuthority: "working_record",
    };
  }

  if (input.docType === "questionnaire") {
    const status = input.rawStatus ?? "";
    if (status === "complete" || status === "reviewed") {
      return {
        experienceStatus: "complete",
        nextActor: null,
        nextActionLabel: null,
        filterStatus: "complete",
        producerHref: input.eventId ? `/events/${input.eventId}` : null,
        artifactAuthority: "working_record",
      };
    }
    if (status === "submitted" || status === "resubmitted") {
      return {
        experienceStatus: "review",
        nextActor: "venue",
        nextActionLabel: "Venue to review",
        filterStatus: "action_needed",
        producerHref: input.eventId ? `/events/${input.eventId}` : null,
        artifactAuthority: "working_record",
      };
    }
    if (status === "changes_requested") {
      return {
        experienceStatus: "changes_requested",
        nextActor: "couple",
        nextActionLabel: `${who} to update`,
        filterStatus: "action_needed",
        producerHref: input.eventId ? `/events/${input.eventId}` : null,
        artifactAuthority: "working_record",
      };
    }
    if (status === "in_progress") {
      return {
        experienceStatus: "in_progress",
        nextActor: "couple",
        nextActionLabel: `${who} to finish`,
        filterStatus: "in_progress",
        producerHref: input.eventId ? `/events/${input.eventId}` : null,
        artifactAuthority: "working_record",
      };
    }
    if (status === "sent") {
      return {
        experienceStatus: "with_someone",
        nextActor: "couple",
        nextActionLabel: `${who} to complete`,
        filterStatus: "action_needed",
        producerHref: input.eventId ? `/events/${input.eventId}` : null,
        artifactAuthority: "working_record",
      };
    }
    return {
      experienceStatus: "draft",
      nextActor: "venue",
      nextActionLabel: "Venue to send",
      filterStatus: "in_progress",
      producerHref: input.eventId ? `/events/${input.eventId}` : null,
      artifactAuthority: "working_record",
    };
  }

  if (input.docType === "contract") {
    const status = input.rawStatus ?? "";
    if (status === "signed" && input.hasFinalArtifact) {
      return {
        experienceStatus: "final",
        nextActor: null,
        nextActionLabel: null,
        filterStatus: "complete",
        producerHref: `/contracts/${input.id}`,
        artifactAuthority: "producer_final",
      };
    }
    if (status === "signed") {
      return {
        experienceStatus: "complete",
        nextActor: "venue",
        nextActionLabel: "Venue can finalize",
        filterStatus: "complete",
        producerHref: `/contracts/${input.id}`,
        artifactAuthority: "working_record",
      };
    }
    if (status === "sent") {
      return {
        experienceStatus: "with_someone",
        nextActor: "couple",
        nextActionLabel: `${who} to sign`,
        filterStatus: "action_needed",
        producerHref: `/contracts/${input.id}`,
        artifactAuthority: "working_record",
      };
    }
    if (status === "draft") {
      return {
        experienceStatus: "draft",
        nextActor: "venue",
        nextActionLabel: "Venue to send",
        filterStatus: "in_progress",
        producerHref: `/contracts/${input.id}`,
        artifactAuthority: "working_record",
      };
    }
    return {
      experienceStatus: "none",
      nextActor: null,
      nextActionLabel: null,
      filterStatus: "none",
      producerHref: `/contracts/${input.id}`,
      artifactAuthority: "working_record",
    };
  }

  if (input.docType === "invoice") {
    const status = input.rawStatus ?? "";
    if (status === "paid") {
      return {
        experienceStatus: "complete",
        nextActor: null,
        nextActionLabel: null,
        filterStatus: "complete",
        producerHref: `/invoices/${input.id}`,
        artifactAuthority: "working_record",
      };
    }
    if (status === "sent") {
      return {
        experienceStatus: "with_someone",
        nextActor: "couple",
        nextActionLabel: `${who} to pay`,
        filterStatus: "action_needed",
        producerHref: `/invoices/${input.id}`,
        artifactAuthority: "working_record",
      };
    }
    if (status === "draft") {
      return {
        experienceStatus: "draft",
        nextActor: "venue",
        nextActionLabel: "Venue to send",
        filterStatus: "in_progress",
        producerHref: `/invoices/${input.id}`,
        artifactAuthority: "working_record",
      };
    }
    return {
      experienceStatus: "none",
      nextActor: null,
      nextActionLabel: null,
      filterStatus: "none",
      producerHref: `/invoices/${input.id}`,
      artifactAuthority: "working_record",
    };
  }

  if (input.docType === "event_order") {
    const status = input.rawStatus ?? "";
    if (status === "finalized") {
      return {
        experienceStatus: "final",
        nextActor: null,
        nextActionLabel: null,
        filterStatus: "complete",
        producerHref: input.eventId ? `/events/${input.eventId}` : null,
        artifactAuthority: input.hasFinalArtifact ? "producer_final" : "working_record",
      };
    }
    if (status === "shared") {
      return {
        experienceStatus: "with_someone",
        nextActor: "couple",
        nextActionLabel: "Shared with couple",
        filterStatus: "in_progress",
        producerHref: input.eventId ? `/events/${input.eventId}` : null,
        artifactAuthority: input.hasFinalArtifact ? "producer_final" : "working_record",
      };
    }
    return {
      experienceStatus: "in_progress",
      nextActor: "venue",
      nextActionLabel: "Venue to complete",
      filterStatus: "in_progress",
      producerHref: input.eventId ? `/events/${input.eventId}` : null,
      artifactAuthority: "working_record",
    };
  }

  return {
    experienceStatus: "none",
    nextActor: null,
    nextActionLabel: null,
    filterStatus: "none",
    producerHref: null,
    artifactAuthority: "working_record",
  };
}

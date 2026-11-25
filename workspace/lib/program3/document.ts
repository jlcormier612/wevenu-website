import type {
  BrandingConfig,
  LocalCommunication,
  LocalTask,
  LocalTimelineEvent,
  RelationshipPatch,
  Sequence,
  SequenceEnrollment,
  Template,
  TemplateCategory,
  Workflow,
  WorkflowRun,
} from "./types";

/** Durable Program 3 document persisted in htc_program3_store.document */
export type Program3Document = {
  seededAt?: string;
  workflows: Workflow[];
  workflowRuns: WorkflowRun[];
  templates: Template[];
  sequences: Sequence[];
  sequenceEnrollments: SequenceEnrollment[];
  categories: TemplateCategory[];
  branding: BrandingConfig;
  relationshipPatches: RelationshipPatch[];
  localTimeline: LocalTimelineEvent[];
  localCommunications: LocalCommunication[];
  localTasks: LocalTask[];
};

export function emptyProgram3Document(): Program3Document {
  return {
    workflows: [],
    workflowRuns: [],
    templates: [],
    sequences: [],
    sequenceEnrollments: [],
    categories: [],
    branding: {
      id: "branding_default",
      fromName: "Hello to Cheers",
      fromEmail: "jennifer@hellotocheers.com",
      replyToEmail: "jennifer@hellotocheers.com",
      signatureHtml: "With care,\nThe Hello to Cheers team",
      updatedAt: new Date(0).toISOString(),
    },
    relationshipPatches: [],
    localTimeline: [],
    localCommunications: [],
    localTasks: [],
  };
}

export function normalizeProgram3Document(
  raw: Partial<Program3Document> | null | undefined,
): Program3Document {
  const base = emptyProgram3Document();
  if (!raw || typeof raw !== "object") return base;
  return {
    seededAt: raw.seededAt,
    workflows: Array.isArray(raw.workflows) ? raw.workflows : [],
    workflowRuns: Array.isArray(raw.workflowRuns) ? raw.workflowRuns : [],
    templates: Array.isArray(raw.templates) ? raw.templates : [],
    sequences: Array.isArray(raw.sequences) ? raw.sequences : [],
    sequenceEnrollments: Array.isArray(raw.sequenceEnrollments)
      ? raw.sequenceEnrollments
      : [],
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    branding: raw.branding && typeof raw.branding === "object"
      ? { ...base.branding, ...raw.branding }
      : base.branding,
    relationshipPatches: Array.isArray(raw.relationshipPatches)
      ? raw.relationshipPatches
      : [],
    localTimeline: Array.isArray(raw.localTimeline) ? raw.localTimeline : [],
    localCommunications: Array.isArray(raw.localCommunications)
      ? raw.localCommunications
      : [],
    localTasks: Array.isArray(raw.localTasks) ? raw.localTasks : [],
  };
}

/**
 * PM-02 guided venue-side Practice Run journey.
 * Progress lives on practice_runs.journey — never on operational CRM lifecycle fields.
 */

export const PRACTICE_STAGE_IDS = [
  "meet_inquiry",
  "prepare_proposal",
  "create_agreement",
  "get_ready",
  "explore_planning",
] as const;

export type PracticeStageId = (typeof PRACTICE_STAGE_IDS)[number];

export type PracticeStageStatus = "not_started" | "in_progress" | "complete";

export type PracticeContractSimStatus =
  | "draft"
  | "sent_to_client"
  | "client_signed"
  | "awaiting_venue_signature"
  | "fully_executed";

export const PRACTICE_CONTRACT_SEQUENCE: PracticeContractSimStatus[] = [
  "draft",
  "sent_to_client",
  "client_signed",
  "awaiting_venue_signature",
  "fully_executed",
];

export type PracticeStageProgress = {
  status: PracticeStageStatus;
  completedAt: string | null;
};

export type PracticeProposalSnapshot = {
  packageId: string | null;
  packageName: string;
  packageSource: "venue" | "practice_fallback";
  totalAmount: number;
  depositAmount: number;
  includedItems: { description: string; quantity: number; unit: string | null }[];
  savedAt: string;
  simulatedDeliveryAt: string | null;
  clientSelectionSimulatedAt: string | null;
};

export type PracticeContractSnapshot = {
  templateSource: "venue" | "practice_fallback";
  templateName: string;
  draftedAt: string;
  simulatedStatus: PracticeContractSimStatus;
  exploredSequenceAt: string | null;
};

export type PracticePlanningSource =
  | "venue_configured"
  | "venue_template"
  | "htc_starter"
  | "practice_fallback";

export type PracticePlanningSnapshot = {
  preparedAt: string | null;
  sharedAt: string | null;
  clientTriedAt: string | null;
  reviewedAt: string | null;
  sources: {
    tasks: PracticePlanningSource;
    timeline: PracticePlanningSource;
    documents: PracticePlanningSource;
    questionnaire: PracticePlanningSource;
    eventOrder: PracticePlanningSource;
    inventory: PracticePlanningSource;
    website: PracticePlanningSource;
  };
  counts: {
    tasks: number;
    timeline: number;
    documentsShared: number;
    documentsPrivate: number;
    questionnaires: number;
  };
  resourceIds: {
    taskIds: string[];
    releaseTaskIds: string[];
    privateTaskIds: string[];
    timelineEntryIds: string[];
    sharedDocumentIds: string[];
    privateDocumentIds: string[];
    questionnaireId: string | null;
    eventOrderId: string | null;
    inventoryId: string | null;
    websiteId: string | null;
  };
};

export type PracticeJourney = {
  stages: Record<PracticeStageId, PracticeStageProgress>;
  currentStageId: PracticeStageId;
  proposal: PracticeProposalSnapshot | null;
  contract: PracticeContractSnapshot | null;
  /** PM-04 planning prepare / share / collaboration progress. */
  planning: PracticePlanningSnapshot | null;
  /** PM-05 — owner finished and returned to setup (run may still be resumed). */
  finishedAt: string | null;
};

/** Practice-only package — never inserted into the venue package library. */
export const PRACTICE_FALLBACK_PACKAGE = {
  id: "practice-fallback-package",
  name: "Practice Celebration Package",
  description:
    "A practice-only example package so you can walk through proposals even before your real packages are set up.",
  totalAmount: 12500,
  depositAmount: 2500,
  includedItems: [
    { description: "Venue rental (ceremony + reception)", quantity: 1, unit: null },
    { description: "Tables and chairs for 120 guests", quantity: 120, unit: "guests" },
    { description: "Day-of coordination support", quantity: 1, unit: null },
  ],
} as const;

/** Practice-only contract template label — never written into template library. */
export const PRACTICE_FALLBACK_CONTRACT_TEMPLATE = {
  id: "practice-fallback-contract",
  name: "Practice Wedding Agreement",
} as const;

export const PRACTICE_STAGE_COPY: Record<
  PracticeStageId,
  {
    title: string;
    heading: string;
    explanation: string;
    primaryLabel: string;
    secondaryLabel: string;
  }
> = {
  meet_inquiry: {
    title: "Meet your new inquiry",
    heading: "Meet Maya & Jordan",
    explanation:
      "Every celebration starts with a conversation. Explore their inquiry, review the details, and see how HTC keeps everything together.",
    primaryLabel: "Open sample inquiry",
    secondaryLabel: "Explore Lead workspace",
  },
  prepare_proposal: {
    title: "Prepare a proposal",
    heading: "Build their perfect celebration",
    explanation:
      "Show Maya and Jordan what your venue offers. Choose a package, personalize their proposal, and see how the booking process comes together.",
    primaryLabel: "Prepare sample proposal",
    secondaryLabel: "Open proposal tools",
  },
  create_agreement: {
    title: "Create the wedding agreement",
    heading: "Make it official",
    explanation:
      "See how the details of a celebration become a clear agreement, ready for your clients to review and sign.",
    primaryLabel: "Prepare sample contract",
    secondaryLabel: "Open contract tools",
  },
  get_ready: {
    title: "Get ready for the celebration",
    heading: "Your wedding workspace is ready",
    explanation:
      "Once a celebration is booked, HTC brings the details and planning tools together so your team can stay organized.",
    primaryLabel: "Explore sample celebration",
    secondaryLabel: "Open celebration workspace",
  },
  explore_planning: {
    title: "Prepare, share, and collaborate",
    heading: "Bring their celebration to life.",
    explanation:
      "See how Hello to Cheers brings everything together for Maya & Jordan. Prepare their planning experience, share it with them, then step into their shoes to see what they'll love.",
    primaryLabel: "Prepare planning resources",
    secondaryLabel: "Open celebration workspace",
  },
};

export function emptyPracticePlanning(): PracticePlanningSnapshot {
  return {
    preparedAt: null,
    sharedAt: null,
    clientTriedAt: null,
    reviewedAt: null,
    sources: {
      tasks: "practice_fallback",
      timeline: "practice_fallback",
      documents: "practice_fallback",
      questionnaire: "practice_fallback",
      eventOrder: "practice_fallback",
      inventory: "practice_fallback",
      website: "practice_fallback",
    },
    counts: {
      tasks: 0,
      timeline: 0,
      documentsShared: 0,
      documentsPrivate: 0,
      questionnaires: 0,
    },
    resourceIds: {
      taskIds: [],
      releaseTaskIds: [],
      privateTaskIds: [],
      timelineEntryIds: [],
      sharedDocumentIds: [],
      privateDocumentIds: [],
      questionnaireId: null,
      eventOrderId: null,
      inventoryId: null,
      websiteId: null,
    },
  };
}

function emptyStage(): PracticeStageProgress {
  return { status: "not_started", completedAt: null };
}

export function emptyPracticeJourney(): PracticeJourney {
  return {
    stages: {
      meet_inquiry: emptyStage(),
      prepare_proposal: emptyStage(),
      create_agreement: emptyStage(),
      get_ready: emptyStage(),
      explore_planning: emptyStage(),
    },
    currentStageId: "meet_inquiry",
    proposal: null,
    contract: null,
    planning: null,
    finishedAt: null,
  };
}

export function isPracticeJourneyComplete(journey: PracticeJourney): boolean {
  return PRACTICE_STAGE_IDS.every((id) => journey.stages[id].status === "complete");
}

export function parsePracticeJourney(raw: unknown): PracticeJourney {
  const base = emptyPracticeJourney();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  const stagesRaw = (row.stages && typeof row.stages === "object" ? row.stages : {}) as Record<
    string,
    unknown
  >;
  for (const id of PRACTICE_STAGE_IDS) {
    const stage = stagesRaw[id];
    if (!stage || typeof stage !== "object") continue;
    const s = stage as Record<string, unknown>;
    const status =
      s.status === "complete" || s.status === "in_progress" || s.status === "not_started"
        ? s.status
        : "not_started";
    base.stages[id] = {
      status,
      completedAt: typeof s.completedAt === "string" ? s.completedAt : null,
    };
  }
  if (
    typeof row.currentStageId === "string"
    && (PRACTICE_STAGE_IDS as readonly string[]).includes(row.currentStageId)
  ) {
    base.currentStageId = row.currentStageId as PracticeStageId;
  } else {
    base.currentStageId = firstIncompleteStage(base) ?? "explore_planning";
  }
  if (row.proposal && typeof row.proposal === "object") {
    const p = row.proposal as Record<string, unknown>;
    base.proposal = {
      packageId: typeof p.packageId === "string" ? p.packageId : null,
      packageName: typeof p.packageName === "string" ? p.packageName : PRACTICE_FALLBACK_PACKAGE.name,
      packageSource: p.packageSource === "venue" ? "venue" : "practice_fallback",
      totalAmount: Number(p.totalAmount) || PRACTICE_FALLBACK_PACKAGE.totalAmount,
      depositAmount: Number(p.depositAmount) || PRACTICE_FALLBACK_PACKAGE.depositAmount,
      includedItems: Array.isArray(p.includedItems)
        ? (p.includedItems as PracticeProposalSnapshot["includedItems"])
        : [...PRACTICE_FALLBACK_PACKAGE.includedItems],
      savedAt: typeof p.savedAt === "string" ? p.savedAt : new Date(0).toISOString(),
      simulatedDeliveryAt: typeof p.simulatedDeliveryAt === "string" ? p.simulatedDeliveryAt : null,
      clientSelectionSimulatedAt:
        typeof p.clientSelectionSimulatedAt === "string" ? p.clientSelectionSimulatedAt : null,
    };
  }
  if (row.contract && typeof row.contract === "object") {
    const c = row.contract as Record<string, unknown>;
    const status = PRACTICE_CONTRACT_SEQUENCE.includes(c.simulatedStatus as PracticeContractSimStatus)
      ? (c.simulatedStatus as PracticeContractSimStatus)
      : "draft";
    base.contract = {
      templateSource: c.templateSource === "venue" ? "venue" : "practice_fallback",
      templateName:
        typeof c.templateName === "string" ? c.templateName : PRACTICE_FALLBACK_CONTRACT_TEMPLATE.name,
      draftedAt: typeof c.draftedAt === "string" ? c.draftedAt : new Date(0).toISOString(),
      simulatedStatus: status,
      exploredSequenceAt: typeof c.exploredSequenceAt === "string" ? c.exploredSequenceAt : null,
    };
  }
  base.finishedAt = typeof row.finishedAt === "string" ? row.finishedAt : null;
  if (row.planning && typeof row.planning === "object") {
    const empty = emptyPracticePlanning();
    const p = row.planning as Record<string, unknown>;
    const sources = (p.sources && typeof p.sources === "object" ? p.sources : {}) as Record<string, unknown>;
    const counts = (p.counts && typeof p.counts === "object" ? p.counts : {}) as Record<string, unknown>;
    const ids = (p.resourceIds && typeof p.resourceIds === "object" ? p.resourceIds : {}) as Record<
      string,
      unknown
    >;
    const asSource = (v: unknown): PracticePlanningSource =>
      v === "venue_configured" || v === "venue_template" || v === "htc_starter" || v === "practice_fallback"
        ? v
        : "practice_fallback";
    const asIds = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    base.planning = {
      preparedAt: typeof p.preparedAt === "string" ? p.preparedAt : null,
      sharedAt: typeof p.sharedAt === "string" ? p.sharedAt : null,
      clientTriedAt: typeof p.clientTriedAt === "string" ? p.clientTriedAt : null,
      reviewedAt: typeof p.reviewedAt === "string" ? p.reviewedAt : null,
      sources: {
        tasks: asSource(sources.tasks),
        timeline: asSource(sources.timeline),
        documents: asSource(sources.documents),
        questionnaire: asSource(sources.questionnaire),
        eventOrder: asSource(sources.eventOrder),
        inventory: asSource(sources.inventory),
        website: asSource(sources.website),
      },
      counts: {
        tasks: Number(counts.tasks) || 0,
        timeline: Number(counts.timeline) || 0,
        documentsShared: Number(counts.documentsShared) || 0,
        documentsPrivate: Number(counts.documentsPrivate) || 0,
        questionnaires: Number(counts.questionnaires) || 0,
      },
      resourceIds: {
        taskIds: asIds(ids.taskIds),
        releaseTaskIds: asIds(ids.releaseTaskIds),
        privateTaskIds: asIds(ids.privateTaskIds),
        timelineEntryIds: asIds(ids.timelineEntryIds),
        sharedDocumentIds: asIds(ids.sharedDocumentIds),
        privateDocumentIds: asIds(ids.privateDocumentIds),
        questionnaireId: typeof ids.questionnaireId === "string" ? ids.questionnaireId : null,
        eventOrderId: typeof ids.eventOrderId === "string" ? ids.eventOrderId : null,
        inventoryId: typeof ids.inventoryId === "string" ? ids.inventoryId : null,
        websiteId: typeof ids.websiteId === "string" ? ids.websiteId : null,
      },
    };
    if (!base.planning.preparedAt && empty.preparedAt === null) {
      // keep parsed object even when only partially filled
    }
  }
  return base;
}

export function firstIncompleteStage(journey: PracticeJourney): PracticeStageId | null {
  for (const id of PRACTICE_STAGE_IDS) {
    if (journey.stages[id].status !== "complete") return id;
  }
  return null;
}

export function markStageInProgress(journey: PracticeJourney, stageId: PracticeStageId): PracticeJourney {
  const current = journey.stages[stageId];
  if (current.status === "complete") {
    return { ...journey, currentStageId: stageId };
  }
  return {
    ...journey,
    currentStageId: stageId,
    stages: {
      ...journey.stages,
      [stageId]: { status: "in_progress", completedAt: null },
    },
  };
}

export function markStageComplete(journey: PracticeJourney, stageId: PracticeStageId, at = new Date()): PracticeJourney {
  const next = {
    ...journey,
    stages: {
      ...journey.stages,
      [stageId]: { status: "complete" as const, completedAt: at.toISOString() },
    },
  };
  next.currentStageId = firstIncompleteStage(next) ?? stageId;
  return next;
}

export function stageStatusLabel(status: PracticeStageStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}

export function contractSimStatusLabel(status: PracticeContractSimStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent_to_client":
      return "Sent to Client";
    case "client_signed":
      return "Client Signed";
    case "awaiting_venue_signature":
      return "Awaiting Venue Signature";
    case "fully_executed":
      return "Fully Executed";
  }
}

export function nextContractSimStatus(
  current: PracticeContractSimStatus,
): PracticeContractSimStatus | null {
  const idx = PRACTICE_CONTRACT_SEQUENCE.indexOf(current);
  if (idx < 0 || idx >= PRACTICE_CONTRACT_SEQUENCE.length - 1) return null;
  return PRACTICE_CONTRACT_SEQUENCE[idx + 1]!;
}

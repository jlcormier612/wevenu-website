/**
 * Four-chapter Setup Hub roadmap (approved onboarding-part1 design).
 * Chapters are guided pathways — not mandatory sequential gates.
 */
import type { SetupStageKey } from "@/lib/setup-hub/help-crosswalk";
import type { SetupStageCompletionStatus } from "@/lib/setup-hub/stage-section-runs";

export type SetupChapterId =
  | "venue-ready"
  | "sales-process"
  | "client-experience"
  | "make-it-yours";

export type SetupChapterDefinition = {
  id: SetupChapterId;
  number: 1 | 2 | 3 | 4;
  title: string;
  /** One-line outcome — why this chapter exists. */
  guidance: string;
  /** Stage keys that belong in this chapter (product stages only). */
  stageKeys: readonly SetupStageKey[];
};

/**
 * Authoritative chapter map. Bring Your Business lives in Chapter 4 so
 * brand-new venues are not pushed into Migration in the first hour.
 */
export const SETUP_CHAPTERS: readonly SetupChapterDefinition[] = [
  {
    id: "venue-ready",
    number: 1,
    title: "Get your venue ready",
    guidance:
      "Help Hello to Cheers recognize your property and protect your calendar — spaces, capacity, and tours.",
    stageKeys: ["your-venue", "calendar-availability"],
  },
  {
    id: "sales-process",
    number: 2,
    title: "Explore your sales process",
    guidance:
      "See how an inquiry becomes a booking — leads, packages, contracts, and payments — without contacting real clients.",
    stageKeys: ["lead-capture", "your-offerings"],
  },
  {
    id: "client-experience",
    number: 3,
    title: "Prepare your client experience",
    guidance:
      "Configure once, customize per event, preview before you share. You choose when clients see anything.",
    stageKeys: ["client-experience"],
  },
  {
    id: "make-it-yours",
    number: 4,
    title: "Make it yours",
    guidance:
      "Optional polish — branding depth, communications, automations, team, integrations, and migration when you're ready.",
    stageKeys: ["your-team", "financials", "bring-your-business"],
  },
] as const;

export type ChapterProgress = {
  id: SetupChapterId;
  number: 1 | 2 | 3 | 4;
  title: string;
  guidance: string;
  status: "complete" | "in_progress" | "not_started";
  /** Required stages addressed / total required in chapter. */
  requiredDone: number;
  requiredTotal: number;
  /** Optional stages done / total optional. */
  optionalDone: number;
  optionalTotal: number;
};

export type StageProgressInput = {
  key: SetupStageKey;
  status: SetupStageCompletionStatus;
  required: boolean;
};

export function chapterProgressFromStages(
  stages: readonly StageProgressInput[],
): ChapterProgress[] {
  const byKey = new Map(stages.map((s) => [s.key, s]));
  return SETUP_CHAPTERS.map((ch) => {
    const members = ch.stageKeys
      .map((key) => byKey.get(key))
      .filter((s): s is StageProgressInput => Boolean(s));
    const required = members.filter((s) => s.required);
    const optional = members.filter((s) => !s.required);
    const requiredDone = required.filter((s) => s.status === "complete").length;
    const optionalDone = optional.filter((s) => s.status === "complete").length;
    const anyProgress = members.some(
      (s) => s.status === "complete" || s.status === "in_progress",
    );
    const requiredComplete =
      required.length === 0 || required.every((s) => s.status === "complete");
    let status: ChapterProgress["status"] = "not_started";
    if (requiredComplete && members.length > 0 && requiredDone === required.length) {
      // Chapter complete when all required stages are complete (optional may remain).
      status = required.length === 0
        ? anyProgress
          ? members.every((s) => s.status === "complete")
            ? "complete"
            : "in_progress"
          : "not_started"
        : "complete";
    } else if (anyProgress || requiredDone > 0) {
      status = "in_progress";
    }
    // If there are no required stages, treat all-optional-complete as complete.
    if (required.length === 0 && optional.length > 0 && optionalDone === optional.length) {
      status = "complete";
    }
    return {
      id: ch.id,
      number: ch.number,
      title: ch.title,
      guidance: ch.guidance,
      status,
      requiredDone,
      requiredTotal: required.length,
      optionalDone,
      optionalTotal: optional.length,
    };
  });
}

export type RecommendedNext = {
  chapterId: SetupChapterId;
  chapterTitle: string;
  stageKey: SetupStageKey;
  stageTitle: string;
  href: string;
  hrefLabel: string;
  reason: string;
};

/**
 * First incomplete required stage in chapter order; falls back to first
 * incomplete optional. Never locks later chapters.
 */
export function recommendNextAction(input: {
  stages: readonly (StageProgressInput & {
    title: string;
    href?: string;
    hrefLabel?: string;
  })[];
}): RecommendedNext | null {
  const byKey = new Map(input.stages.map((s) => [s.key, s]));
  const pass = (onlyRequired: boolean) => {
    for (const ch of SETUP_CHAPTERS) {
      for (const key of ch.stageKeys) {
        const stage = byKey.get(key);
        if (!stage) continue;
        if (onlyRequired && !stage.required) continue;
        if (stage.status === "complete") continue;
        if (!stage.href || !stage.hrefLabel) continue;
        return {
          chapterId: ch.id,
          chapterTitle: ch.title,
          stageKey: key,
          stageTitle: stage.title,
          href: stage.href,
          hrefLabel: stage.hrefLabel,
          reason: onlyRequired
            ? `Recommended next in ${ch.title}`
            : `Optional next in ${ch.title}`,
        } satisfies RecommendedNext;
      }
    }
    return null;
  };
  return pass(true) ?? pass(false);
}

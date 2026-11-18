/**
 * Pure builders — couple-visible planning facts for Ask Luv.
 * Bounded structured facts only; never invent status or times.
 */

import type {
  LuvAskPlanningFacts,
  LuvAskQuestionnaireFact,
  LuvAskTaskFact,
  LuvAskTimelineEntryFact,
} from "@/lib/luv/portal-context/types";

export const LUV_ASK_MAX_OPEN_TASKS = 12;
export const LUV_ASK_MAX_COMPLETED_TASKS = 8;
export const LUV_ASK_MAX_TIMELINE_ENTRIES = 20;
export const LUV_ASK_MAX_QUESTIONNAIRES = 8;

export type PlanningTaskInput = {
  title?: string | null;
  status?: string | null;
  dueDate?: string | null;
  isRequired?: boolean;
  /** client_visible | client_owned — both are couple-facing. */
  visibility?: string | null;
};

export type PlanningQuestionnaireInput = {
  title?: string | null;
  name?: string | null;
  kind?: string | null;
  status?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
};

export type PlanningTimelineEntryInput = {
  title?: string | null;
  entryTime?: string | null;
  endTime?: string | null;
  dayOffset?: number | null;
  owner?: string | null;
  /** Couple-visible when audiences include client/couple OR owner is client. */
  audiences?: string[] | null;
};

function todayYmd(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function formatDueLabel(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const day = dueDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function normalizeTaskStatus(
  status: string | null | undefined,
  dueDate: string | null,
  today: string,
): LuvAskTaskFact["status"] {
  const s = (status ?? "").toLowerCase();
  if (s === "complete" || s === "completed" || s === "done") return "completed";
  if (s === "blocked") return "blocked";
  if (s === "overdue") return "overdue";
  if (dueDate) {
    const day = dueDate.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < today) return "overdue";
  }
  return "open";
}

function questionnaireStatus(raw: string | null | undefined): LuvAskQuestionnaireFact["status"] {
  const s = (raw ?? "").toLowerCase();
  if (
    s === "submitted"
    || s === "completed"
    || s === "complete"
    || s === "reviewed"
    || s === "resubmitted"
  ) {
    return "completed";
  }
  if (s === "in_progress" || s === "started" || s === "opened") return "in_progress";
  return "open";
}

function isCoupleVisibleTimelineEntry(e: PlanningTimelineEntryInput): boolean {
  const owner = (e.owner ?? "").toLowerCase();
  if (owner === "client" || owner === "couple") return true;
  const audiences = e.audiences ?? [];
  return audiences.some((a) => {
    const v = a.toLowerCase();
    return v === "client" || v === "clients" || v === "couple" || v === "couples";
  });
}

export function buildLuvAskPlanningFacts(input: {
  tasks?: PlanningTaskInput[] | null;
  questionnaires?: PlanningQuestionnaireInput[] | null;
  timelineEntries?: PlanningTimelineEntryInput[] | null;
  timelineAvailable?: boolean;
  now?: Date;
}): LuvAskPlanningFacts {
  const now = input.now ?? new Date();
  const today = todayYmd(now);

  const openTasks: LuvAskTaskFact[] = [];
  const completedTasks: LuvAskTaskFact[] = [];
  let openCount = 0;
  let overdueCount = 0;
  let completedCount = 0;

  for (const t of input.tasks ?? []) {
    const title = (t.title ?? "").trim();
    if (!title) continue;
    const dueDate = t.dueDate ? String(t.dueDate).slice(0, 10) : null;
    const status = normalizeTaskStatus(t.status, dueDate, today);
    const fact: LuvAskTaskFact = {
      title,
      status,
      dueDate: dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
      dueDateLabel: formatDueLabel(dueDate),
      isRequired: Boolean(t.isRequired),
    };
    if (status === "completed") {
      completedCount += 1;
      if (completedTasks.length < LUV_ASK_MAX_COMPLETED_TASKS) completedTasks.push(fact);
    } else {
      openCount += 1;
      if (status === "overdue") overdueCount += 1;
      if (openTasks.length < LUV_ASK_MAX_OPEN_TASKS) openTasks.push(fact);
    }
  }

  // Prefer overdue / required first among open (stable sort within loaded set).
  openTasks.sort((a, b) => {
    const rank = (x: LuvAskTaskFact) =>
      (x.status === "overdue" ? 0 : 1) * 10 + (x.isRequired ? 0 : 1);
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  const questionnaires: LuvAskQuestionnaireFact[] = [];
  let openQuestionnaires = 0;
  let completedQuestionnaires = 0;
  for (const q of (input.questionnaires ?? []).slice(0, LUV_ASK_MAX_QUESTIONNAIRES)) {
    const title = (q.title ?? q.name ?? q.kind ?? "").trim();
    if (!title) continue;
    const status = questionnaireStatus(q.status);
    if (status === "completed") completedQuestionnaires += 1;
    else openQuestionnaires += 1;
    questionnaires.push({
      title,
      kind: (q.kind ?? "").trim() || null,
      status,
    });
  }

  const timelineEntries: LuvAskTimelineEntryFact[] = [];
  const timelineAvailable = input.timelineAvailable !== false;
  if (timelineAvailable) {
    for (const e of input.timelineEntries ?? []) {
      if (!isCoupleVisibleTimelineEntry(e)) continue;
      const title = (e.title ?? "").trim();
      if (!title) continue;
      timelineEntries.push({
        title,
        entryTime: e.entryTime ? String(e.entryTime).slice(0, 5) : null,
        endTime: e.endTime ? String(e.endTime).slice(0, 5) : null,
        dayOffset: Number(e.dayOffset ?? 0) || 0,
        owner: (e.owner ?? "").toLowerCase() === "client" ? "client" : "venue",
      });
      if (timelineEntries.length >= LUV_ASK_MAX_TIMELINE_ENTRIES) break;
    }
  }

  const nextOpen = openTasks[0] ?? null;

  return {
    openTaskCount: openCount,
    overdueTaskCount: overdueCount,
    completedTaskCount: completedCount,
    openTasks,
    completedTasks,
    nextSuggestedTask: nextOpen
      ? {
          title: nextOpen.title,
          dueDateLabel: nextOpen.dueDateLabel,
          status: nextOpen.status,
        }
      : null,
    questionnaires,
    openQuestionnaireCount: openQuestionnaires,
    completedQuestionnaireCount: completedQuestionnaires,
    timelineAvailable,
    timelineEntries,
  };
}

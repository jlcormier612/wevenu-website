import { randomUUID } from "crypto";
import { existsSync } from "fs";
import path from "path";

import {
  filePath,
  readJsonFile,
  readJsonFileSync,
  readJsonl,
  readJsonlSync,
  withWorkspaceLock,
  writeJsonAtomic,
  writeJsonlAtomic,
} from "./jsonl";
import { PROGRAM3_FILES } from "./paths";
import {
  SEED_BRANDING,
  SEED_CATEGORIES,
  SEED_SEQUENCES,
  SEED_TEMPLATES,
  SEED_WORKFLOWS,
} from "./seed";
import { DEFAULT_SEQUENCE_TIMEZONE } from "./schedule";
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

function workflowsPath() {
  return filePath(PROGRAM3_FILES.workflows);
}
function runsPath() {
  return filePath(PROGRAM3_FILES.workflowRuns);
}
function templatesPath() {
  return filePath(PROGRAM3_FILES.templates);
}
function sequencesPath() {
  return filePath(PROGRAM3_FILES.sequences);
}
function sequenceEnrollmentsPath() {
  return filePath(PROGRAM3_FILES.sequenceEnrollments);
}
function categoriesPath() {
  return filePath(PROGRAM3_FILES.categories);
}
function brandingPath() {
  return filePath(PROGRAM3_FILES.branding);
}
function patchesPath() {
  return filePath(PROGRAM3_FILES.relationshipPatches);
}
function localTimelinePath() {
  return filePath(PROGRAM3_FILES.localTimeline);
}
function localCommsPath() {
  return filePath(PROGRAM3_FILES.localCommunications);
}
function localTasksPath() {
  return filePath(PROGRAM3_FILES.localTasks);
}
function seedMarkerPath() {
  return filePath(PROGRAM3_FILES.seedMarker);
}

async function ensureSeeded(): Promise<void> {
  const marker = seedMarkerPath();
  if (existsSync(marker)) return;

  await withWorkspaceLock(async () => {
    if (existsSync(marker)) return;
    await writeJsonlAtomic(workflowsPath(), SEED_WORKFLOWS);
    await writeJsonlAtomic(runsPath(), []);
    await writeJsonlAtomic(templatesPath(), SEED_TEMPLATES);
    await writeJsonlAtomic(sequencesPath(), SEED_SEQUENCES);
    await writeJsonlAtomic(sequenceEnrollmentsPath(), []);
    await writeJsonlAtomic(categoriesPath(), SEED_CATEGORIES);
    await writeJsonAtomic(brandingPath(), SEED_BRANDING);
    await writeJsonlAtomic(patchesPath(), []);
    await writeJsonlAtomic(localTimelinePath(), []);
    await writeJsonlAtomic(localCommsPath(), []);
    await writeJsonlAtomic(localTasksPath(), []);
    await writeJsonAtomic(marker, { seededAt: new Date().toISOString() });
  });
}

function ensureSeededSync(): void {
  const marker = seedMarkerPath();
  if (existsSync(marker)) return;
  // Sync path used by page renders — trigger async seed via blocking write if empty.
  // Prefer calling ensureSeeded() from API routes; here we fall back to in-memory seed.
}

function normalizeSequenceRecord(seq: Sequence): Sequence {
  return {
    ...seq,
    targeting: seq.targeting ?? "any",
    timezone: seq.timezone || DEFAULT_SEQUENCE_TIMEZONE,
    active: seq.active !== false,
    steps: (seq.steps ?? []).map((step) => ({
      ...step,
      delayHours: step.delayHours ?? 0,
      scheduleMode: step.scheduleMode ?? "relative",
    })),
  };
}

/** Sync reads fall back to seed constants until files exist. */
export function getWorkflowsSync(): Workflow[] {
  ensureSeededSync();
  const rows = readJsonlSync<Workflow>(workflowsPath());
  return rows.length ? rows : structuredClone(SEED_WORKFLOWS);
}

export function getWorkflowSync(id: string): Workflow | undefined {
  return getWorkflowsSync().find((w) => w.id === id);
}

export function getWorkflowRunsSync(opts?: {
  relationshipId?: string;
  workflowId?: string;
}): WorkflowRun[] {
  const rows = readJsonlSync<WorkflowRun>(runsPath());
  return rows
    .filter((r) => {
      if (opts?.relationshipId && r.relationshipId !== opts.relationshipId) return false;
      if (opts?.workflowId && r.workflowId !== opts.workflowId) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getWorkflowRunSync(id: string): WorkflowRun | undefined {
  return readJsonlSync<WorkflowRun>(runsPath()).find((r) => r.id === id);
}

export function getTemplatesSync(): Template[] {
  const rows = readJsonlSync<Template>(templatesPath());
  return rows.length ? rows : structuredClone(SEED_TEMPLATES);
}

export function getTemplateSync(id: string): Template | undefined {
  return getTemplatesSync().find((t) => t.id === id);
}

export function getSequencesSync(): Sequence[] {
  const rows = readJsonlSync<Sequence>(sequencesPath());
  const list = rows.length ? rows : structuredClone(SEED_SEQUENCES);
  return list.map(normalizeSequenceRecord);
}

export function getSequenceSync(id: string): Sequence | undefined {
  return getSequencesSync().find((s) => s.id === id);
}

export function getSequenceEnrollmentsSync(opts?: {
  relationshipId?: string;
  sequenceId?: string;
}): SequenceEnrollment[] {
  const rows = readJsonlSync<SequenceEnrollment>(sequenceEnrollmentsPath());
  return rows
    .filter((e) => {
      if (opts?.relationshipId && e.relationshipId !== opts.relationshipId) return false;
      if (opts?.sequenceId && e.sequenceId !== opts.sequenceId) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSequenceEnrollmentSync(id: string): SequenceEnrollment | undefined {
  return readJsonlSync<SequenceEnrollment>(sequenceEnrollmentsPath()).find((e) => e.id === id);
}

export function getCategoriesSync(): TemplateCategory[] {
  const rows = readJsonlSync<TemplateCategory>(categoriesPath());
  return rows.length ? rows : structuredClone(SEED_CATEGORIES);
}

export function getBrandingSync(): BrandingConfig {
  return readJsonFileSync(brandingPath(), structuredClone(SEED_BRANDING));
}

export function getRelationshipPatchesSync(): RelationshipPatch[] {
  return readJsonlSync<RelationshipPatch>(patchesPath());
}

export function getLocalTimelineSync(relationshipId?: string): LocalTimelineEvent[] {
  return readJsonlSync<LocalTimelineEvent>(localTimelinePath())
    .filter((e) => !relationshipId || e.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function getLocalCommunicationsSync(relationshipId?: string): LocalCommunication[] {
  return readJsonlSync<LocalCommunication>(localCommsPath())
    .filter((c) => !relationshipId || c.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function getLocalTasksSync(relationshipId?: string): LocalTask[] {
  return readJsonlSync<LocalTask>(localTasksPath()).filter(
    (t) => !relationshipId || t.relationshipId === relationshipId,
  );
}

export async function ensureProgram3Data(): Promise<void> {
  await ensureSeeded();
  await mergeLibrarySeedExtras();
}

/** Add any new seed categories / templates / sequences missing from an older install. */
async function mergeLibrarySeedExtras(): Promise<void> {
  await withWorkspaceLock(async () => {
    const cats = await readJsonl<TemplateCategory>(categoriesPath());
    const catList = cats.length ? cats : structuredClone(SEED_CATEGORIES);
    let catsChanged = false;
    for (const seed of SEED_CATEGORIES) {
      if (!catList.some((c) => c.id === seed.id)) {
        catList.push(seed);
        catsChanged = true;
      }
    }
    if (catsChanged) await writeJsonlAtomic(categoriesPath(), catList);

    const templates = await readJsonl<Template>(templatesPath());
    const tplList = templates.length ? templates : structuredClone(SEED_TEMPLATES);
    let tplChanged = false;
    for (const seed of SEED_TEMPLATES) {
      if (!tplList.some((t) => t.id === seed.id)) {
        tplList.push(seed);
        tplChanged = true;
      }
    }
    if (tplChanged) await writeJsonlAtomic(templatesPath(), tplList);

    const sequences = await readJsonl<Sequence>(sequencesPath());
    const seqList = sequences.length ? sequences : structuredClone(SEED_SEQUENCES);
    let seqChanged = false;
    for (const seed of SEED_SEQUENCES) {
      if (!seqList.some((s) => s.id === seed.id)) {
        seqList.push(seed);
        seqChanged = true;
      }
    }
    // Soft-upgrade existing sequences missing targeting/timezone
    for (let i = 0; i < seqList.length; i += 1) {
      const before = JSON.stringify(seqList[i]);
      seqList[i] = normalizeSequenceRecord(seqList[i]);
      if (JSON.stringify(seqList[i]) !== before) seqChanged = true;
    }
    if (seqChanged) await writeJsonlAtomic(sequencesPath(), seqList);

    if (!existsSync(sequenceEnrollmentsPath())) {
      await writeJsonlAtomic(sequenceEnrollmentsPath(), []);
    }
  });
}

export async function saveWorkflows(workflows: Workflow[]): Promise<void> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    await writeJsonlAtomic(workflowsPath(), workflows);
  });
}

export async function upsertWorkflow(workflow: Workflow): Promise<Workflow> {
  await ensureSeeded();
  return withWorkspaceLock(async () => {
    const all = await readJsonl<Workflow>(workflowsPath());
    const list = all.length ? all : structuredClone(SEED_WORKFLOWS);
    const idx = list.findIndex((w) => w.id === workflow.id);
    if (idx >= 0) list[idx] = workflow;
    else list.push(workflow);
    await writeJsonlAtomic(workflowsPath(), list);
    return workflow;
  });
}

export async function saveWorkflowRuns(runs: WorkflowRun[]): Promise<void> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    await writeJsonlAtomic(runsPath(), runs);
  });
}

export async function upsertWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
  await ensureSeeded();
  return withWorkspaceLock(async () => {
    const all = await readJsonl<WorkflowRun>(runsPath());
    const idx = all.findIndex((r) => r.id === run.id);
    if (idx >= 0) all[idx] = run;
    else all.push(run);
    await writeJsonlAtomic(runsPath(), all);
    return run;
  });
}

export async function upsertTemplate(template: Template): Promise<Template> {
  await ensureSeeded();
  return withWorkspaceLock(async () => {
    const all = await readJsonl<Template>(templatesPath());
    const list = all.length ? all : structuredClone(SEED_TEMPLATES);
    const idx = list.findIndex((t) => t.id === template.id);
    if (idx >= 0) list[idx] = template;
    else list.push(template);
    await writeJsonlAtomic(templatesPath(), list);
    return template;
  });
}

export async function upsertSequence(sequence: Sequence): Promise<Sequence> {
  await ensureSeeded();
  return withWorkspaceLock(async () => {
    const all = await readJsonl<Sequence>(sequencesPath());
    const list = all.length ? all : structuredClone(SEED_SEQUENCES);
    const normalized = normalizeSequenceRecord(sequence);
    const idx = list.findIndex((s) => s.id === normalized.id);
    if (idx >= 0) list[idx] = normalized;
    else list.push(normalized);
    await writeJsonlAtomic(sequencesPath(), list);
    return normalized;
  });
}

export async function upsertSequenceEnrollment(
  enrollment: SequenceEnrollment,
): Promise<SequenceEnrollment> {
  await ensureSeeded();
  return withWorkspaceLock(async () => {
    const all = await readJsonl<SequenceEnrollment>(sequenceEnrollmentsPath());
    const idx = all.findIndex((e) => e.id === enrollment.id);
    if (idx >= 0) all[idx] = enrollment;
    else all.push(enrollment);
    await writeJsonlAtomic(sequenceEnrollmentsPath(), all);
    return enrollment;
  });
}

export async function saveBranding(branding: BrandingConfig): Promise<BrandingConfig> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    await writeJsonAtomic(brandingPath(), branding);
  });
  return branding;
}

export async function upsertCategory(category: TemplateCategory): Promise<TemplateCategory> {
  await ensureSeeded();
  return withWorkspaceLock(async () => {
    const all = await readJsonl<TemplateCategory>(categoriesPath());
    const list = all.length ? all : structuredClone(SEED_CATEGORIES);
    const idx = list.findIndex((c) => c.id === category.id);
    if (idx >= 0) list[idx] = category;
    else list.push(category);
    await writeJsonlAtomic(categoriesPath(), list);
    return category;
  });
}

export async function appendRelationshipPatch(patch: RelationshipPatch): Promise<void> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    const all = await readJsonl<RelationshipPatch>(patchesPath());
    // Keep latest patch per relationship (merge fields).
    const prev = all.find((p) => p.relationshipId === patch.relationshipId);
    const merged: RelationshipPatch = { ...prev, ...patch };
    const next = all.filter((p) => p.relationshipId !== patch.relationshipId);
    next.push(merged);
    await writeJsonlAtomic(patchesPath(), next);
  });
}

export async function appendLocalTimeline(event: LocalTimelineEvent): Promise<void> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    const all = await readJsonl<LocalTimelineEvent>(localTimelinePath());
    all.push(event);
    await writeJsonlAtomic(localTimelinePath(), all);
  });
}

export async function appendLocalCommunication(comm: LocalCommunication): Promise<void> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    const all = await readJsonl<LocalCommunication>(localCommsPath());
    all.push(comm);
    await writeJsonlAtomic(localCommsPath(), all);
  });
}

export async function appendLocalTask(task: LocalTask): Promise<void> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    const all = await readJsonl<LocalTask>(localTasksPath());
    all.push(task);
    await writeJsonlAtomic(localTasksPath(), all);
  });
}

/** Insert or replace a local task by id (used for Complete overlays on seed tasks). */
export async function upsertLocalTask(task: LocalTask): Promise<void> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    const all = await readJsonl<LocalTask>(localTasksPath());
    const idx = all.findIndex((t) => t.id === task.id);
    if (idx >= 0) all[idx] = task;
    else all.push(task);
    await writeJsonlAtomic(localTasksPath(), all);
  });
}

export async function bumpTemplateSent(templateId: string): Promise<void> {
  await ensureSeeded();
  await withWorkspaceLock(async () => {
    const all = await readJsonl<Template>(templatesPath());
    const list = all.length ? all : structuredClone(SEED_TEMPLATES);
    const tpl = list.find((t) => t.id === templateId);
    if (tpl) {
      tpl.sentCount += 1;
      tpl.updatedAt = new Date().toISOString();
      await writeJsonlAtomic(templatesPath(), list);
    }
  });
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function loadBranding(): Promise<BrandingConfig> {
  await ensureSeeded();
  return readJsonFile(brandingPath(), structuredClone(SEED_BRANDING));
}

/** Absolute path helper for docs. */
export function program3DataDir(): string {
  return path.dirname(workflowsPath());
}

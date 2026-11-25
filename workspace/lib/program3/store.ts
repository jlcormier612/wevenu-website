import { randomUUID } from "crypto";
import { existsSync } from "fs";
import path from "path";

import type { Program3Document } from "./document";
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
import {
  ensureProgram3MemorySync,
  getProgram3MemorySync,
  loadProgram3Document,
  mutateProgram3Document,
  usePostgresProgram3Store,
} from "./store-postgres";
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

function normalizeSequenceRecord(seq: Sequence): Sequence {
  return {
    ...seq,
    targeting: seq.targeting ?? "any",
    timezone: seq.timezone || DEFAULT_SEQUENCE_TIMEZONE,
    active: seq.active === true,
    steps: (seq.steps ?? []).map((step) => ({
      ...step,
      delayHours: step.delayHours ?? 0,
      scheduleMode: step.scheduleMode ?? "relative",
    })),
  };
}

function readLocalFileBundle(): Program3Document | null {
  const marker = seedMarkerPath();
  if (!existsSync(marker) && !existsSync(workflowsPath())) return null;
  return {
    seededAt: readJsonFileSync<{ seededAt?: string }>(marker, {}).seededAt,
    workflows: readJsonlSync<Workflow>(workflowsPath()),
    workflowRuns: readJsonlSync<WorkflowRun>(runsPath()),
    templates: readJsonlSync<Template>(templatesPath()),
    sequences: readJsonlSync<Sequence>(sequencesPath()).map(normalizeSequenceRecord),
    sequenceEnrollments: readJsonlSync<SequenceEnrollment>(sequenceEnrollmentsPath()),
    categories: readJsonlSync<TemplateCategory>(categoriesPath()),
    branding: readJsonFileSync(brandingPath(), structuredClone(SEED_BRANDING)),
    relationshipPatches: readJsonlSync<RelationshipPatch>(patchesPath()),
    localTimeline: readJsonlSync<LocalTimelineEvent>(localTimelinePath()),
    localCommunications: readJsonlSync<LocalCommunication>(localCommsPath()),
    localTasks: readJsonlSync<LocalTask>(localTasksPath()),
  };
}

function seedDocument(fromLocal?: Program3Document | null): Program3Document {
  if (fromLocal && (fromLocal.workflows.length || fromLocal.templates.length)) {
    return {
      ...fromLocal,
      seededAt: fromLocal.seededAt || new Date().toISOString(),
      workflows: fromLocal.workflows.length
        ? fromLocal.workflows
        : structuredClone(SEED_WORKFLOWS),
      templates: fromLocal.templates.length
        ? fromLocal.templates
        : structuredClone(SEED_TEMPLATES),
      sequences: (fromLocal.sequences.length
        ? fromLocal.sequences
        : structuredClone(SEED_SEQUENCES)
      ).map(normalizeSequenceRecord),
      categories: fromLocal.categories.length
        ? fromLocal.categories
        : structuredClone(SEED_CATEGORIES),
      branding: fromLocal.branding?.fromEmail
        ? fromLocal.branding
        : structuredClone(SEED_BRANDING),
    };
  }
  return {
    seededAt: new Date().toISOString(),
    workflows: structuredClone(SEED_WORKFLOWS),
    workflowRuns: [],
    templates: structuredClone(SEED_TEMPLATES),
    sequences: structuredClone(SEED_SEQUENCES).map(normalizeSequenceRecord),
    sequenceEnrollments: [],
    categories: structuredClone(SEED_CATEGORIES),
    branding: structuredClone(SEED_BRANDING),
    relationshipPatches: [],
    localTimeline: [],
    localCommunications: [],
    localTasks: [],
  };
}

async function ensureSeededFile(): Promise<void> {
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

async function ensureSeededPostgres(): Promise<void> {
  const loaded = await loadProgram3Document();
  const doc = loaded.document;
  const empty =
    !doc.seededAt &&
    doc.workflows.length === 0 &&
    doc.templates.length === 0 &&
    doc.sequences.length === 0;
  if (!empty) return;

  const local = readLocalFileBundle();
  await mutateProgram3Document((working) => {
    if (working.seededAt || working.workflows.length || working.templates.length) {
      return;
    }
    const seeded = seedDocument(local);
    Object.assign(working, seeded);
  });
}

async function ensureSeeded(): Promise<void> {
  if (usePostgresProgram3Store()) {
    await ensureSeededPostgres();
    return;
  }
  await ensureSeededFile();
}

function ensureSeededSync(): void {
  if (usePostgresProgram3Store()) {
    ensureProgram3MemorySync();
  }
}

function pgDoc(): Program3Document {
  return getProgram3MemorySync() ?? ensureProgram3MemorySync();
}

/** Sync reads fall back to seed constants until files exist. */
export function getWorkflowsSync(): Workflow[] {
  ensureSeededSync();
  if (usePostgresProgram3Store()) {
    const rows = pgDoc().workflows;
    return rows.length ? rows : structuredClone(SEED_WORKFLOWS);
  }
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
  const rows = usePostgresProgram3Store()
    ? pgDoc().workflowRuns
    : readJsonlSync<WorkflowRun>(runsPath());
  return rows
    .filter((r) => {
      if (opts?.relationshipId && r.relationshipId !== opts.relationshipId) return false;
      if (opts?.workflowId && r.workflowId !== opts.workflowId) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getWorkflowRunSync(id: string): WorkflowRun | undefined {
  return getWorkflowRunsSync().find((r) => r.id === id);
}

export function getTemplatesSync(): Template[] {
  if (usePostgresProgram3Store()) {
    const rows = pgDoc().templates;
    return rows.length ? rows : structuredClone(SEED_TEMPLATES);
  }
  const rows = readJsonlSync<Template>(templatesPath());
  return rows.length ? rows : structuredClone(SEED_TEMPLATES);
}

export function getTemplateSync(id: string): Template | undefined {
  return getTemplatesSync().find((t) => t.id === id);
}

export function getSequencesSync(): Sequence[] {
  if (usePostgresProgram3Store()) {
    const rows = pgDoc().sequences;
    const list = rows.length ? rows : structuredClone(SEED_SEQUENCES);
    return list.map(normalizeSequenceRecord);
  }
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
  const rows = usePostgresProgram3Store()
    ? pgDoc().sequenceEnrollments
    : readJsonlSync<SequenceEnrollment>(sequenceEnrollmentsPath());
  return rows
    .filter((e) => {
      if (opts?.relationshipId && e.relationshipId !== opts.relationshipId) return false;
      if (opts?.sequenceId && e.sequenceId !== opts.sequenceId) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSequenceEnrollmentSync(id: string): SequenceEnrollment | undefined {
  return getSequenceEnrollmentsSync().find((e) => e.id === id);
}

export function getCategoriesSync(): TemplateCategory[] {
  if (usePostgresProgram3Store()) {
    const rows = pgDoc().categories;
    return rows.length ? rows : structuredClone(SEED_CATEGORIES);
  }
  const rows = readJsonlSync<TemplateCategory>(categoriesPath());
  return rows.length ? rows : structuredClone(SEED_CATEGORIES);
}

export function getBrandingSync(): BrandingConfig {
  if (usePostgresProgram3Store()) {
    return structuredClone(pgDoc().branding || SEED_BRANDING);
  }
  return readJsonFileSync(brandingPath(), structuredClone(SEED_BRANDING));
}

export function getRelationshipPatchesSync(): RelationshipPatch[] {
  if (usePostgresProgram3Store()) return structuredClone(pgDoc().relationshipPatches);
  return readJsonlSync<RelationshipPatch>(patchesPath());
}

export function getLocalTimelineSync(relationshipId?: string): LocalTimelineEvent[] {
  const rows = usePostgresProgram3Store()
    ? pgDoc().localTimeline
    : readJsonlSync<LocalTimelineEvent>(localTimelinePath());
  return rows
    .filter((e) => !relationshipId || e.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function getLocalCommunicationsSync(relationshipId?: string): LocalCommunication[] {
  const rows = usePostgresProgram3Store()
    ? pgDoc().localCommunications
    : readJsonlSync<LocalCommunication>(localCommsPath());
  return rows
    .filter((c) => !relationshipId || c.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function getLocalTasksSync(relationshipId?: string): LocalTask[] {
  const rows = usePostgresProgram3Store()
    ? pgDoc().localTasks
    : readJsonlSync<LocalTask>(localTasksPath());
  return rows.filter((t) => !relationshipId || t.relationshipId === relationshipId);
}

async function mergeLibrarySeedExtrasPostgres(): Promise<void> {
  await mutateProgram3Document((doc) => {
    let changed = false;
    for (const seed of SEED_CATEGORIES) {
      if (!doc.categories.some((c) => c.id === seed.id)) {
        doc.categories.push(seed);
        changed = true;
      }
    }
    for (const seed of SEED_TEMPLATES) {
      if (!doc.templates.some((t) => t.id === seed.id)) {
        doc.templates.push(seed);
        changed = true;
      }
    }
    for (const seed of SEED_SEQUENCES) {
      if (!doc.sequences.some((s) => s.id === seed.id)) {
        doc.sequences.push(normalizeSequenceRecord(seed));
        changed = true;
      }
    }
    for (const seed of SEED_WORKFLOWS) {
      if (!doc.workflows.some((w) => w.id === seed.id)) {
        doc.workflows.push(structuredClone(seed));
        changed = true;
      }
    }
    for (let i = 0; i < doc.sequences.length; i += 1) {
      const before = JSON.stringify(doc.sequences[i]);
      doc.sequences[i] = normalizeSequenceRecord(doc.sequences[i]);
      if (JSON.stringify(doc.sequences[i]) !== before) changed = true;
    }
    if (!doc.seededAt) {
      doc.seededAt = new Date().toISOString();
      changed = true;
    }
    return changed;
  });
}

/** Add any new seed categories / templates / sequences missing from an older install. */
async function mergeLibrarySeedExtrasFile(): Promise<void> {
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
    for (let i = 0; i < seqList.length; i += 1) {
      const before = JSON.stringify(seqList[i]);
      seqList[i] = normalizeSequenceRecord(seqList[i]);
      if (JSON.stringify(seqList[i]) !== before) seqChanged = true;
    }
    if (seqChanged) await writeJsonlAtomic(sequencesPath(), seqList);

    const workflows = await readJsonl<Workflow>(workflowsPath());
    const wfList = workflows.length ? workflows : structuredClone(SEED_WORKFLOWS);
    let wfChanged = false;
    for (const seed of SEED_WORKFLOWS) {
      if (!wfList.some((w) => w.id === seed.id)) {
        wfList.push(structuredClone(seed));
        wfChanged = true;
      }
    }
    if (wfChanged) await writeJsonlAtomic(workflowsPath(), wfList);

    if (!existsSync(sequenceEnrollmentsPath())) {
      await writeJsonlAtomic(sequenceEnrollmentsPath(), []);
    }
  });
}

export async function ensureProgram3Data(): Promise<void> {
  await ensureSeeded();
  if (usePostgresProgram3Store()) {
    await mergeLibrarySeedExtrasPostgres();
    await loadProgram3Document();
    return;
  }
  await mergeLibrarySeedExtrasFile();
}

async function withStoreMutation<T>(fn: (doc: Program3Document) => T | Promise<T>): Promise<T> {
  if (usePostgresProgram3Store()) {
    await ensureSeeded();
    return mutateProgram3Document(fn);
  }
  await ensureSeeded();
  return withWorkspaceLock(async () => {
    const doc: Program3Document = {
      workflows: (await readJsonl<Workflow>(workflowsPath())).length
        ? await readJsonl<Workflow>(workflowsPath())
        : structuredClone(SEED_WORKFLOWS),
      workflowRuns: await readJsonl<WorkflowRun>(runsPath()),
      templates: (await readJsonl<Template>(templatesPath())).length
        ? await readJsonl<Template>(templatesPath())
        : structuredClone(SEED_TEMPLATES),
      sequences: ((await readJsonl<Sequence>(sequencesPath())).length
        ? await readJsonl<Sequence>(sequencesPath())
        : structuredClone(SEED_SEQUENCES)
      ).map(normalizeSequenceRecord),
      sequenceEnrollments: await readJsonl<SequenceEnrollment>(sequenceEnrollmentsPath()),
      categories: (await readJsonl<TemplateCategory>(categoriesPath())).length
        ? await readJsonl<TemplateCategory>(categoriesPath())
        : structuredClone(SEED_CATEGORIES),
      branding: await readJsonFile(brandingPath(), structuredClone(SEED_BRANDING)),
      relationshipPatches: await readJsonl<RelationshipPatch>(patchesPath()),
      localTimeline: await readJsonl<LocalTimelineEvent>(localTimelinePath()),
      localCommunications: await readJsonl<LocalCommunication>(localCommsPath()),
      localTasks: await readJsonl<LocalTask>(localTasksPath()),
    };
    const result = await fn(doc);
    await writeJsonlAtomic(workflowsPath(), doc.workflows);
    await writeJsonlAtomic(runsPath(), doc.workflowRuns);
    await writeJsonlAtomic(templatesPath(), doc.templates);
    await writeJsonlAtomic(sequencesPath(), doc.sequences);
    await writeJsonlAtomic(sequenceEnrollmentsPath(), doc.sequenceEnrollments);
    await writeJsonlAtomic(categoriesPath(), doc.categories);
    await writeJsonAtomic(brandingPath(), doc.branding);
    await writeJsonlAtomic(patchesPath(), doc.relationshipPatches);
    await writeJsonlAtomic(localTimelinePath(), doc.localTimeline);
    await writeJsonlAtomic(localCommsPath(), doc.localCommunications);
    await writeJsonlAtomic(localTasksPath(), doc.localTasks);
    return result;
  });
}

export async function saveWorkflows(workflows: Workflow[]): Promise<void> {
  await withStoreMutation((doc) => {
    doc.workflows = workflows;
  });
}

export async function upsertWorkflow(workflow: Workflow): Promise<Workflow> {
  return withStoreMutation((doc) => {
    const list = doc.workflows.length ? doc.workflows : structuredClone(SEED_WORKFLOWS);
    const idx = list.findIndex((w) => w.id === workflow.id);
    if (idx >= 0) list[idx] = workflow;
    else list.push(workflow);
    doc.workflows = list;
    return workflow;
  });
}

export async function saveWorkflowRuns(runs: WorkflowRun[]): Promise<void> {
  await withStoreMutation((doc) => {
    doc.workflowRuns = runs;
  });
}

export async function upsertWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
  return withStoreMutation((doc) => {
    const idx = doc.workflowRuns.findIndex((r) => r.id === run.id);
    if (idx >= 0) doc.workflowRuns[idx] = run;
    else doc.workflowRuns.push(run);
    return run;
  });
}

export async function upsertTemplate(template: Template): Promise<Template> {
  return withStoreMutation((doc) => {
    const list = doc.templates.length ? doc.templates : structuredClone(SEED_TEMPLATES);
    const idx = list.findIndex((t) => t.id === template.id);
    if (idx >= 0) list[idx] = template;
    else list.push(template);
    doc.templates = list;
    return template;
  });
}

export async function upsertSequence(sequence: Sequence): Promise<Sequence> {
  return withStoreMutation((doc) => {
    const list = doc.sequences.length ? doc.sequences : structuredClone(SEED_SEQUENCES);
    const normalized = normalizeSequenceRecord(sequence);
    const idx = list.findIndex((s) => s.id === normalized.id);
    if (idx >= 0) list[idx] = normalized;
    else list.push(normalized);
    doc.sequences = list;
    return normalized;
  });
}

export async function upsertSequenceEnrollment(
  enrollment: SequenceEnrollment,
): Promise<SequenceEnrollment> {
  return withStoreMutation((doc) => {
    const idx = doc.sequenceEnrollments.findIndex((e) => e.id === enrollment.id);
    if (idx >= 0) doc.sequenceEnrollments[idx] = enrollment;
    else doc.sequenceEnrollments.push(enrollment);
    return enrollment;
  });
}

export async function saveBranding(branding: BrandingConfig): Promise<BrandingConfig> {
  await withStoreMutation((doc) => {
    doc.branding = branding;
  });
  return branding;
}

export async function upsertCategory(category: TemplateCategory): Promise<TemplateCategory> {
  return withStoreMutation((doc) => {
    const list = doc.categories.length ? doc.categories : structuredClone(SEED_CATEGORIES);
    const idx = list.findIndex((c) => c.id === category.id);
    if (idx >= 0) list[idx] = category;
    else list.push(category);
    doc.categories = list;
    return category;
  });
}

export async function appendRelationshipPatch(patch: RelationshipPatch): Promise<void> {
  await withStoreMutation((doc) => {
    const prev = doc.relationshipPatches.find((p) => p.relationshipId === patch.relationshipId);
    const merged: RelationshipPatch = { ...prev, ...patch };
    doc.relationshipPatches = [
      ...doc.relationshipPatches.filter((p) => p.relationshipId !== patch.relationshipId),
      merged,
    ];
  });
}

export async function appendLocalTimeline(event: LocalTimelineEvent): Promise<void> {
  await withStoreMutation((doc) => {
    doc.localTimeline.push(event);
  });
}

export async function appendLocalCommunication(comm: LocalCommunication): Promise<void> {
  await withStoreMutation((doc) => {
    doc.localCommunications.push(comm);
  });
}

export async function appendLocalTask(task: LocalTask): Promise<void> {
  await withStoreMutation((doc) => {
    doc.localTasks.push(task);
  });
}

/** Insert or replace a local task by id (used for Complete overlays on seed tasks). */
export async function upsertLocalTask(task: LocalTask): Promise<void> {
  await withStoreMutation((doc) => {
    const idx = doc.localTasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) doc.localTasks[idx] = task;
    else doc.localTasks.push(task);
  });
}

export async function bumpTemplateSent(templateId: string): Promise<void> {
  await withStoreMutation((doc) => {
    const list = doc.templates.length ? doc.templates : structuredClone(SEED_TEMPLATES);
    const tpl = list.find((t) => t.id === templateId);
    if (tpl) {
      tpl.sentCount += 1;
      tpl.updatedAt = new Date().toISOString();
      doc.templates = list;
    }
  });
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function loadBranding(): Promise<BrandingConfig> {
  await ensureProgram3Data();
  return getBrandingSync();
}

/** Absolute path helper for docs. */
export function program3DataDir(): string {
  return path.dirname(workflowsPath());
}

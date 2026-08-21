/**
 * File-backed Relationships store (local smoke / HTC_CRM_STORE=file only).
 * Production marketing + workspace use Postgres via store.ts.
 */

import { existsSync, readFileSync } from "fs";
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";

import { getRelationshipsDataDir, STORE_FILES } from "./paths";
import type {
  Communication,
  LiveRelationshipStore,
  Notification,
  Relationship,
  RelationshipTask,
  Subscription,
  SupportInboxItem,
  TimelineEvent,
  Walkthrough,
} from "./types";

const EMPTY_STORE: LiveRelationshipStore = {
  relationships: [],
  timelineEvents: [],
  communications: [],
  walkthroughs: [],
  subscriptions: [],
  notifications: [],
  tasks: [],
  supportInboxItems: [],
};

async function ensureDataDir(): Promise<string> {
  const dir = getRelationshipsDataDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

function readJsonlSync<T>(filePath: string): T[] {
  try {
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

async function writeJsonlAtomic(filePath: string, rows: unknown[]): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const body = rows.length ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  await writeFile(tmp, body, "utf8");
  await rename(tmp, filePath);
}

async function withFileLock<T>(fn: () => Promise<T>): Promise<T> {
  const dir = await ensureDataDir();
  const lockPath = path.join(dir, "store.lock");
  const started = Date.now();

  while (true) {
    try {
      await writeFile(lockPath, `${process.pid}\n${Date.now()}`, { flag: "wx" });
      break;
    } catch {
      if (Date.now() - started > 8_000) {
        try {
          await unlink(lockPath);
        } catch {
          /* ignore */
        }
        if (Date.now() - started > 12_000) {
          throw new Error("Timed out waiting for relationships store lock.");
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }

  try {
    return await fn();
  } finally {
    await unlink(lockPath).catch(() => undefined);
  }
}

function readStoreFromDir(dir: string): LiveRelationshipStore {
  return {
    relationships: readJsonlSync<Relationship>(path.join(dir, STORE_FILES.relationships)),
    timelineEvents: readJsonlSync<TimelineEvent>(path.join(dir, STORE_FILES.timelineEvents)),
    communications: readJsonlSync<Communication>(path.join(dir, STORE_FILES.communications)),
    walkthroughs: readJsonlSync<Walkthrough>(path.join(dir, STORE_FILES.walkthroughs)),
    subscriptions: readJsonlSync<Subscription>(path.join(dir, STORE_FILES.subscriptions)),
    notifications: readJsonlSync<Notification>(path.join(dir, STORE_FILES.notifications)),
    tasks: readJsonlSync<RelationshipTask>(path.join(dir, STORE_FILES.tasks)),
    supportInboxItems: readJsonlSync<SupportInboxItem>(
      path.join(dir, STORE_FILES.supportInboxItems),
    ),
  };
}

export function emptyFileStore(): LiveRelationshipStore {
  return structuredClone(EMPTY_STORE);
}

export function loadFileStoreSync(): LiveRelationshipStore {
  const dir = getRelationshipsDataDir();
  if (!existsSync(dir)) {
    return emptyFileStore();
  }
  return readStoreFromDir(dir);
}

export async function loadFileStore(): Promise<LiveRelationshipStore> {
  const dir = await ensureDataDir();
  const [
    relationships,
    timelineEvents,
    communications,
    walkthroughs,
    subscriptions,
    notifications,
    tasks,
    supportInboxItems,
  ] = await Promise.all([
    readJsonl<Relationship>(path.join(dir, STORE_FILES.relationships)),
    readJsonl<TimelineEvent>(path.join(dir, STORE_FILES.timelineEvents)),
    readJsonl<Communication>(path.join(dir, STORE_FILES.communications)),
    readJsonl<Walkthrough>(path.join(dir, STORE_FILES.walkthroughs)),
    readJsonl<Subscription>(path.join(dir, STORE_FILES.subscriptions)),
    readJsonl<Notification>(path.join(dir, STORE_FILES.notifications)),
    readJsonl<RelationshipTask>(path.join(dir, STORE_FILES.tasks)),
    readJsonl<SupportInboxItem>(path.join(dir, STORE_FILES.supportInboxItems)),
  ]);

  return {
    relationships,
    timelineEvents,
    communications,
    walkthroughs,
    subscriptions,
    notifications,
    tasks,
    supportInboxItems,
  };
}

export async function saveFileStore(store: LiveRelationshipStore): Promise<void> {
  const dir = await ensureDataDir();
  if (!store.tasks) store.tasks = [];
  if (!store.supportInboxItems) store.supportInboxItems = [];
  await Promise.all([
    writeJsonlAtomic(path.join(dir, STORE_FILES.relationships), store.relationships),
    writeJsonlAtomic(path.join(dir, STORE_FILES.timelineEvents), store.timelineEvents),
    writeJsonlAtomic(path.join(dir, STORE_FILES.communications), store.communications),
    writeJsonlAtomic(path.join(dir, STORE_FILES.walkthroughs), store.walkthroughs),
    writeJsonlAtomic(path.join(dir, STORE_FILES.subscriptions), store.subscriptions),
    writeJsonlAtomic(path.join(dir, STORE_FILES.notifications), store.notifications),
    writeJsonlAtomic(path.join(dir, STORE_FILES.tasks), store.tasks),
    writeJsonlAtomic(path.join(dir, STORE_FILES.supportInboxItems), store.supportInboxItems),
  ]);
}

export async function withFileStore<T>(
  mutate: (store: LiveRelationshipStore) => T | Promise<T>,
): Promise<{ result: T; store: LiveRelationshipStore }> {
  return withFileLock(async () => {
    const store = await loadFileStore();
    const result = await mutate(store);
    await saveFileStore(store);
    return { result, store };
  });
}

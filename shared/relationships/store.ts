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
  };
}

/** Sync load for workspace Server Components. */
export function loadLiveStoreSync(): LiveRelationshipStore {
  const dir = getRelationshipsDataDir();
  if (!existsSync(dir)) {
    return emptyLiveStore();
  }
  return readStoreFromDir(dir);
}

export async function loadLiveStore(): Promise<LiveRelationshipStore> {
  const dir = await ensureDataDir();
  const [
    relationships,
    timelineEvents,
    communications,
    walkthroughs,
    subscriptions,
    notifications,
    tasks,
  ] = await Promise.all([
    readJsonl<Relationship>(path.join(dir, STORE_FILES.relationships)),
    readJsonl<TimelineEvent>(path.join(dir, STORE_FILES.timelineEvents)),
    readJsonl<Communication>(path.join(dir, STORE_FILES.communications)),
    readJsonl<Walkthrough>(path.join(dir, STORE_FILES.walkthroughs)),
    readJsonl<Subscription>(path.join(dir, STORE_FILES.subscriptions)),
    readJsonl<Notification>(path.join(dir, STORE_FILES.notifications)),
    readJsonl<RelationshipTask>(path.join(dir, STORE_FILES.tasks)),
  ]);

  return {
    relationships,
    timelineEvents,
    communications,
    walkthroughs,
    subscriptions,
    notifications,
    tasks,
  };
}

export async function hasLiveRelationships(): Promise<boolean> {
  return loadLiveStoreSync().relationships.length > 0;
}

export function hasLiveRelationshipsSync(): boolean {
  return loadLiveStoreSync().relationships.length > 0;
}

/** Replace the entire live store (used by service mutations under lock). */
export async function saveLiveStore(store: LiveRelationshipStore): Promise<void> {
  const dir = await ensureDataDir();
  if (!store.tasks) store.tasks = [];
  await Promise.all([
    writeJsonlAtomic(path.join(dir, STORE_FILES.relationships), store.relationships),
    writeJsonlAtomic(path.join(dir, STORE_FILES.timelineEvents), store.timelineEvents),
    writeJsonlAtomic(path.join(dir, STORE_FILES.communications), store.communications),
    writeJsonlAtomic(path.join(dir, STORE_FILES.walkthroughs), store.walkthroughs),
    writeJsonlAtomic(path.join(dir, STORE_FILES.subscriptions), store.subscriptions),
    writeJsonlAtomic(path.join(dir, STORE_FILES.notifications), store.notifications),
    writeJsonlAtomic(path.join(dir, STORE_FILES.tasks), store.tasks),
  ]);
}

/**
 * Mutate the store under an exclusive lock.
 * Prefer this over load+save for concurrent marketing + workspace writes.
 */
export async function withLiveStore<T>(
  mutate: (store: LiveRelationshipStore) => T | Promise<T>,
): Promise<{ result: T; store: LiveRelationshipStore }> {
  return withFileLock(async () => {
    const store = await loadLiveStore();
    const result = await mutate(store);
    await saveLiveStore(store);
    return { result, store };
  });
}

export function emptyLiveStore(): LiveRelationshipStore {
  return structuredClone(EMPTY_STORE);
}

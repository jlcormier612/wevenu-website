import { existsSync, readFileSync } from "fs";
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";

import { getWorkspaceDataDir } from "./paths";

async function ensureDataDir(): Promise<string> {
  const dir = getWorkspaceDataDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function readJsonlSync<T>(filePath: string): T[] {
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

export async function readJsonl<T>(filePath: string): Promise<T[]> {
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

export async function writeJsonlAtomic(filePath: string, rows: unknown[]): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const body = rows.length ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  await writeFile(tmp, body, "utf8");
  await rename(tmp, filePath);
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readJsonFileSync<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export async function withWorkspaceLock<T>(fn: () => Promise<T>): Promise<T> {
  const dir = await ensureDataDir();
  const lockPath = path.join(dir, "program3.lock");
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
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  try {
    return await fn();
  } finally {
    try {
      await unlink(lockPath);
    } catch {
      /* ignore */
    }
  }
}

export function filePath(name: string): string {
  return path.join(getWorkspaceDataDir(), name);
}

import { existsSync } from "fs";
import path from "path";

/**
 * Resolve product-sync data directory (local adapter artifacts).
 *
 * Env: PRODUCT_SYNC_DATA_PATH
 * Default: <repo>/shared/product-sync/.data
 */
export function getProductSyncDataDir(): string {
  const fromEnv = process.env.PRODUCT_SYNC_DATA_PATH?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "shared", "product-sync", ".data"),
    path.join(cwd, "..", "shared", "product-sync", ".data"),
    path.join(cwd, "..", "..", "shared", "product-sync", ".data"),
  ];

  for (const candidate of candidates) {
    const moduleDir = path.dirname(candidate);
    if (existsSync(moduleDir) || existsSync(path.join(moduleDir, "types.ts"))) {
      return candidate;
    }
  }

  return path.join(cwd, "..", "shared", "product-sync", ".data");
}

import { httpProductSyncAdapter } from "./http";
import { localProductSyncAdapter } from "./local";
import type { ProductSyncAdapter, ProductSyncAdapterName } from "./types";

export type { ProductSyncAdapter, ProductSyncAdapterName } from "./types";
export { localProductSyncAdapter } from "./local";
export { httpProductSyncAdapter } from "./http";

/**
 * Resolve adapter from PRODUCT_SYNC_ADAPTER env (local | http).
 * Default: local (file-backed simulation).
 */
export function getProductSyncAdapter(): ProductSyncAdapter {
  const name = (process.env.PRODUCT_SYNC_ADAPTER?.trim().toLowerCase() ||
    "local") as ProductSyncAdapterName;
  if (name === "http") return httpProductSyncAdapter;
  return localProductSyncAdapter;
}

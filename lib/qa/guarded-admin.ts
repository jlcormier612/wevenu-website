/**
 * QA admin client that refuses mutations targeting curated Sandbox venues.
 * Use in write-capable automated tests instead of a raw service-role client.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertWritableVenueIdInPayload } from "@/lib/qa/protected-venues";

type AnyClient = SupabaseClient<any, any, any>;

function wrapQuery(builder: any, purpose: string): any {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (prop === "insert" || prop === "upsert" || prop === "update") {
        return (payload: unknown, opts?: unknown) => {
          assertWritableVenueIdInPayload(payload, `${purpose}.${String(prop)}`);
          const next = value.call(target, payload, opts);
          return wrapQuery(next, purpose);
        };
      }
      if (prop === "delete") {
        return (...args: unknown[]) => {
          const next = value.apply(target, args);
          return wrapQuery(next, purpose);
        };
      }
      if (prop === "eq") {
        return (col: string, val: unknown) => {
          if (col === "venue_id" && typeof val === "string") {
            assertWritableVenueIdInPayload({ venue_id: val }, `${purpose}.eq`);
          }
          const next = value.call(target, col, val);
          return wrapQuery(next, purpose);
        };
      }
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        // Thenable query builders are objects — keep wrapping until terminal.
        if (result && typeof result === "object") return wrapQuery(result, purpose);
        return result;
      };
    },
  });
}

export function createGuardedQaAdmin(purpose = "qa-write"): AnyClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env for guarded QA admin");
  if (!url.includes("wvpsldwwjqdannqasrdf")) {
    throw new Error("REFUSED: guarded QA admin is Sandbox-only");
  }
  const raw = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return new Proxy(raw, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "from" && typeof value === "function") {
        return (table: string) => wrapQuery(value.call(target, table), `${purpose}.${table}`);
      }
      if (prop === "rpc" && typeof value === "function") {
        return (fn: string, args?: Record<string, unknown>) => {
          assertWritableVenueIdInPayload(args ?? {}, `${purpose}.rpc.${fn}`);
          return value.call(target, fn, args);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as AnyClient;
}

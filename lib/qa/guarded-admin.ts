/**
 * QA admin client that refuses mutations targeting curated Sandbox venues.
 * Requires an explicit disposable venue context. ID-only updates/deletes and
 * RPCs without a venue id fail closed — absence of venue_id is not safety.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assertWritableQaVenue,
  assertWritableVenueIdInPayload,
  collectVenueIds,
  isFounderProtectedQaMaintenanceEnabled,
} from "@/lib/qa/protected-venues";

type AnyClient = SupabaseClient<any, any, any>;

export type GuardedQaAdminOptions = {
  purpose?: string;
  /** Required disposable venue for all writes (defaults to DISPOSABLE_VENUE_ID). */
  disposableVenueId?: string;
};

type QueryState = {
  purpose: string;
  disposableVenueId: string;
  seenVenueIds: Set<string>;
  pendingMutation: "insert" | "upsert" | "update" | "delete" | "rpc" | null;
};

function noteVenueIds(state: QueryState, payload: unknown) {
  for (const id of collectVenueIds(payload)) state.seenVenueIds.add(id);
}

function assertMutationAllowed(state: QueryState) {
  if (isFounderProtectedQaMaintenanceEnabled()) return;

  if (state.seenVenueIds.size === 0) {
    throw new Error(
      `REFUSED: ${state.purpose} mutation lacks verified venue scope. ` +
        `Pass venue_id (or eq('venue_id', …)) for disposable venue ${state.disposableVenueId}. ` +
        `ID-only mutations are not permitted.`,
    );
  }

  for (const id of state.seenVenueIds) {
    assertWritableQaVenue({ venueId: id, purpose: state.purpose });
    if (id !== state.disposableVenueId) {
      throw new Error(
        `REFUSED: ${state.purpose} targets venue ${id} but disposable context is ${state.disposableVenueId}.`,
      );
    }
  }
}

function wrapQuery(builder: any, state: QueryState): any {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;

      if (prop === "insert" || prop === "upsert" || prop === "update") {
        return (payload: unknown, opts?: unknown) => {
          state.pendingMutation = prop as "insert" | "upsert" | "update";
          noteVenueIds(state, payload);
          assertWritableVenueIdInPayload(payload, `${state.purpose}.${String(prop)}`);
          assertMutationAllowed(state);
          const next = value.call(target, payload, opts);
          return wrapQuery(next, state);
        };
      }

      if (prop === "delete") {
        return (...args: unknown[]) => {
          state.pendingMutation = "delete";
          const next = value.apply(target, args);
          return wrapQuery(next, state);
        };
      }

      if (prop === "eq") {
        return (col: string, val: unknown) => {
          if (col === "venue_id" && typeof val === "string") {
            state.seenVenueIds.add(val);
            assertWritableVenueIdInPayload({ venue_id: val }, `${state.purpose}.eq`);
          }
          const next = value.call(target, col, val);
          return wrapQuery(next, state);
        };
      }

      if (prop === "in") {
        return (col: string, vals: unknown) => {
          if (col === "venue_id" && Array.isArray(vals)) {
            for (const v of vals) {
              if (typeof v === "string") {
                state.seenVenueIds.add(v);
                assertWritableVenueIdInPayload({ venue_id: v }, `${state.purpose}.in`);
              }
            }
          }
          const next = value.call(target, col, vals);
          return wrapQuery(next, state);
        };
      }

      if (prop === "then") {
        // Terminal execution — refuse delete/update that never established venue scope.
        if (state.pendingMutation === "delete" || state.pendingMutation === "update") {
          assertMutationAllowed(state);
        }
        return value.bind(target);
      }

      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        if (result && typeof result === "object") return wrapQuery(result, state);
        return result;
      };
    },
  });
}

export function createGuardedQaAdmin(opts: GuardedQaAdminOptions | string = {}): AnyClient {
  const normalized: GuardedQaAdminOptions =
    typeof opts === "string" ? { purpose: opts } : opts ?? {};
  const purpose = normalized.purpose ?? "qa-write";
  const disposableVenueId =
    normalized.disposableVenueId?.trim() || process.env.DISPOSABLE_VENUE_ID?.trim() || "";

  if (!disposableVenueId) {
    throw new Error(
      "REFUSED: set DISPOSABLE_VENUE_ID (or pass disposableVenueId) to an isolated disposable venue.",
    );
  }
  assertWritableQaVenue({ venueId: disposableVenueId, purpose: `${purpose}.context` });

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
        return (table: string) => {
          const state: QueryState = {
            purpose: `${purpose}.${table}`,
            disposableVenueId,
            seenVenueIds: new Set(),
            pendingMutation: null,
          };
          return wrapQuery(value.call(target, table), state);
        };
      }
      if (prop === "rpc" && typeof value === "function") {
        return (fn: string, args?: Record<string, unknown>) => {
          const state: QueryState = {
            purpose: `${purpose}.rpc.${fn}`,
            disposableVenueId,
            seenVenueIds: new Set(),
            pendingMutation: "rpc",
          };
          noteVenueIds(state, args ?? {});
          assertWritableVenueIdInPayload(args ?? {}, state.purpose);
          assertMutationAllowed(state);
          return value.call(target, fn, args);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as AnyClient;
}

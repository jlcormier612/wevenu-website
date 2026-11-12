/**
 * Pure controller for Floor Plan Working Layout permission toggles.
 *
 * Extracted so delayed / out-of-order saves can be unit-tested without React.
 * The React hook is a thin adapter over this state machine.
 */

export type PermissionSaveResult = { ok: true } | { ok: false; message?: string };

export type OptimisticPermissionState = {
  value: boolean;
  pending: boolean;
  error: string | null;
  /** Monotonic generation — only the latest in-flight save may settle UI. */
  gen: number;
  /**
   * Last successful intent. Held until server props catch up so a stale
   * router.refresh() cannot overwrite a confirmed optimistic selection.
   */
  desired: boolean | null;
};

export function createOptimisticPermissionState(serverValue: boolean): OptimisticPermissionState {
  return {
    value: serverValue,
    pending: false,
    error: null,
    gen: 0,
    desired: null,
  };
}

export function beginOptimisticToggle(
  state: OptimisticPermissionState,
  next: boolean,
): { state: OptimisticPermissionState; gen: number; previous: boolean } {
  const gen = state.gen + 1;
  return {
    gen,
    previous: state.value,
    state: {
      ...state,
      gen,
      error: null,
      desired: next,
      value: next,
      pending: true,
    },
  };
}

export function settleOptimisticToggle(
  state: OptimisticPermissionState,
  gen: number,
  result: PermissionSaveResult,
  previous: boolean,
): { state: OptimisticPermissionState; stale: boolean } {
  if (gen !== state.gen) {
    return { state, stale: true };
  }
  if (!result.ok) {
    return {
      stale: false,
      state: {
        ...state,
        desired: null,
        value: previous,
        error: result.message ?? "Could not save this permission.",
        pending: false,
      },
    };
  }
  return {
    stale: false,
    state: {
      ...state,
      pending: false,
      error: null,
      // keep desired until adoptServerValue sees a matching server prop
    },
  };
}

export function adoptServerValue(
  state: OptimisticPermissionState,
  serverValue: boolean,
): OptimisticPermissionState {
  if (state.pending) return state;
  if (state.desired != null) {
    if (serverValue === state.desired) {
      return { ...state, desired: null, value: serverValue, error: null };
    }
    // Keep optimistic value until props match the last successful intent.
    return state;
  }
  return { ...state, value: serverValue };
}

/**
 * Simulate rapid clicks with deferred saves. Returns the final state after
 * all clicks are issued and all saves settle (including late/stale ones).
 */
export async function simulateOptimisticToggleSequence(
  initialServer: boolean,
  clicks: Array<{
    /** Delay before this click relative to t=0 (ms). */
    atMs: number;
    /** How long the save for this click takes (ms). */
    saveMs: number;
    /** Whether this save succeeds. */
    ok: boolean;
    message?: string;
  }>,
): Promise<OptimisticPermissionState> {
  let state = createOptimisticPermissionState(initialServer);
  const saves: Array<Promise<void>> = [];

  await new Promise<void>((resolveAll) => {
    let started = 0;
    for (const click of clicks) {
      setTimeout(() => {
        const next = !state.value;
        const { state: begun, gen, previous } = beginOptimisticToggle(state, next);
        state = begun;
        const save = new Promise<void>((resolveSave) => {
          setTimeout(() => {
            const settled = settleOptimisticToggle(
              state,
              gen,
              click.ok
                ? { ok: true }
                : { ok: false, message: click.message ?? "save failed" },
              previous,
            );
            state = settled.state;
            resolveSave();
          }, click.saveMs);
        });
        saves.push(save);
        started += 1;
        if (started === clicks.length) {
          void Promise.all(saves).then(() => resolveAll());
        }
      }, click.atMs);
    }
    if (clicks.length === 0) resolveAll();
  });

  return state;
}

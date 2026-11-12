"use client";

/**
 * Optimistic boolean permission toggles for Floor Plan Working Layout.
 *
 * Visible state flips on the same click. Persistence is async. A monotonic
 * generation counter ignores stale responses so rapid toggles cannot apply
 * an older save over a newer selection. Independent pending flags per hook
 * instance — never a shared card-wide lock.
 *
 * After a successful save, the optimistic value is held until server props
 * catch up (or a newer click supersedes). That prevents router.refresh()
 * from briefly replaying a stale serverValue over a confirmed selection.
 */
import * as React from "react";

import {
  adoptServerValue,
  beginOptimisticToggle,
  createOptimisticPermissionState,
  settleOptimisticToggle,
  type PermissionSaveResult,
} from "@/lib/floor-plans/optimistic-permission-controller";

export type { PermissionSaveResult };

export function useOptimisticPermissionToggle(serverValue: boolean) {
  const [state, setState] = React.useState(() => createOptimisticPermissionState(serverValue));
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    setState((prev) => adoptServerValue(prev, serverValue));
  }, [serverValue]);

  const run = React.useCallback(
    async (next: boolean, save: (next: boolean) => Promise<PermissionSaveResult>) => {
      const { state: begun, gen, previous } = beginOptimisticToggle(stateRef.current, next);
      stateRef.current = begun;
      setState(begun);
      try {
        const result = await save(next);
        const settled = settleOptimisticToggle(stateRef.current, gen, result, previous);
        stateRef.current = settled.state;
        setState(settled.state);
        return { stale: settled.stale, result };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save this permission.";
        const settled = settleOptimisticToggle(
          stateRef.current,
          gen,
          { ok: false, message },
          previous,
        );
        stateRef.current = settled.state;
        setState(settled.state);
        return { stale: settled.stale, result: { ok: false as const, message } };
      }
    },
    [],
  );

  const toggle = React.useCallback(
    (save: (next: boolean) => Promise<PermissionSaveResult>) =>
      run(!stateRef.current.value, save),
    [run],
  );

  return {
    value: state.value,
    pending: state.pending,
    error: state.error,
    setError: (message: string | null) =>
      setState((prev) => ({ ...prev, error: message })),
    run,
    toggle,
  };
}

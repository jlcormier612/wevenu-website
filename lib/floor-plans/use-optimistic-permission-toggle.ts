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

export type PermissionSaveResult = { ok: true } | { ok: false; message?: string };

export function useOptimisticPermissionToggle(serverValue: boolean) {
  const [value, setValue] = React.useState(serverValue);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const genRef = React.useRef(0);
  const valueRef = React.useRef(value);
  const desiredRef = React.useRef<boolean | null>(null);
  valueRef.current = value;

  React.useEffect(() => {
    if (pending) return;
    if (desiredRef.current != null) {
      if (serverValue === desiredRef.current) {
        desiredRef.current = null;
        setValue(serverValue);
      }
      // else: keep optimistic value until props match the last successful intent
      return;
    }
    setValue(serverValue);
  }, [serverValue, pending]);

  const run = React.useCallback(
    async (next: boolean, save: (next: boolean) => Promise<PermissionSaveResult>) => {
      const gen = ++genRef.current;
      const previous = valueRef.current;
      setError(null);
      desiredRef.current = next;
      setValue(next);
      setPending(true);
      try {
        const result = await save(next);
        if (gen !== genRef.current) return { stale: true as const, result };
        if (!result.ok) {
          desiredRef.current = null;
          setValue(previous);
          setError(result.message ?? "Could not save this permission.");
          return { stale: false as const, result };
        }
        return { stale: false as const, result };
      } catch (err) {
        if (gen !== genRef.current) return { stale: true as const, result: { ok: false as const } };
        desiredRef.current = null;
        setValue(previous);
        const message = err instanceof Error ? err.message : "Could not save this permission.";
        setError(message);
        return { stale: false as const, result: { ok: false as const, message } };
      } finally {
        if (gen === genRef.current) setPending(false);
      }
    },
    [],
  );

  const toggle = React.useCallback(
    (save: (next: boolean) => Promise<PermissionSaveResult>) => run(!valueRef.current, save),
    [run],
  );

  return { value, pending, error, setError, run, toggle };
}

"use client";

import * as React from "react";

/**
 * State seeded from a prop, kept in sync when that prop's identity changes.
 *
 * A plain `useState(someProp)` only reads its initializer on first mount —
 * if the component stays mounted and later receives a new value for that
 * prop (most commonly after `router.refresh()` gives an already-mounted
 * client component fresh server data), the state silently keeps its old
 * value forever. Confirmed as a real, user-facing bug twice in this
 * codebase already (2026-07-15): applying a Timeline Template, and
 * applying a Planning Playbook, both wrote real rows and both correctly
 * refreshed the page's server data, but the already-mounted list
 * components never looked at the new props again.
 *
 * This is React's own documented pattern for "adjusting state when a prop
 * changes": compare against the previous value during render and call
 * setState conditionally, not inside a `useEffect` — avoids both the extra
 * render pass an effect-based sync would cost and this project's
 * `react-hooks/set-state-in-effect` lint rule.
 *
 * Pass a stable fallback (a module-level constant, not a fresh `[]`/`{}`
 * literal) when defaulting an optional prop — a new literal every render
 * would never be referentially equal to itself and would loop forever.
 */
export function useSyncedState<T>(value: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [prev, setPrev] = React.useState(value);
  const [state, setState] = React.useState(value);
  if (value !== prev) {
    setPrev(value);
    setState(value);
  }
  return [state, setState];
}

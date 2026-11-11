/**
 * Disabled appointment types cannot block event bookings.
 * One-way: OFF appointment ⇒ blocksAvailability OFF.
 * Re-enabling does not force blocksAvailability ON.
 */

export type AppointmentBlocksState = {
  enabled: boolean;
  blocksAvailability: boolean;
};

/** Pure coerce for catalog settings persistence and UI. */
export function applyAppointmentBlocksInvariant(
  state: AppointmentBlocksState,
): AppointmentBlocksState {
  if (!state.enabled) {
    return { enabled: false, blocksAvailability: false };
  }
  return {
    enabled: true,
    blocksAvailability: state.blocksAvailability,
  };
}

/**
 * Merge a settings patch onto the current row, then apply the invariant.
 * Turning enabled off always clears blocksAvailability in the same write.
 */
export function mergeAppointmentBlocksPatch(
  current: AppointmentBlocksState,
  patch: { enabled?: boolean; blocksAvailability?: boolean },
): AppointmentBlocksState {
  const next: AppointmentBlocksState = {
    enabled: patch.enabled !== undefined ? patch.enabled : current.enabled,
    blocksAvailability:
      patch.blocksAvailability !== undefined
        ? patch.blocksAvailability
        : current.blocksAvailability,
  };
  return applyAppointmentBlocksInvariant(next);
}

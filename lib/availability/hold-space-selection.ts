/**
 * Hold form space-scope selection — Whole venue vs individual spaces.
 * Empty `spaceIds` on submit means whole-venue; non-empty means those spaces only.
 */

export type HoldSpaceSelection = {
  wholeVenue: boolean;
  selectedSpaceIds: string[];
};

/** Clicking Whole venue always clears every individual space. */
export function selectWholeVenue(): HoldSpaceSelection {
  return { wholeVenue: true, selectedSpaceIds: [] };
}

/**
 * Unchecking Whole venue leaves scope empty — do not silently reselect spaces
 * or Whole venue. Validation asks the user to pick a scope.
 */
export function clearWholeVenue(): HoldSpaceSelection {
  return { wholeVenue: false, selectedSpaceIds: [] };
}

/**
 * Clicking any individual space clears Whole venue. Multiple spaces can be
 * selected; unchecking the last space leaves an empty selection (not Whole venue).
 */
export function toggleIndividualSpace(
  current: HoldSpaceSelection,
  spaceId: string,
): HoldSpaceSelection {
  const withoutWhole: HoldSpaceSelection = {
    wholeVenue: false,
    selectedSpaceIds: current.wholeVenue ? [] : current.selectedSpaceIds,
  };
  const nextIds = withoutWhole.selectedSpaceIds.includes(spaceId)
    ? withoutWhole.selectedSpaceIds.filter((id) => id !== spaceId)
    : [...withoutWhole.selectedSpaceIds, spaceId];
  return { wholeVenue: false, selectedSpaceIds: nextIds };
}

/** Submit payload: [] = whole venue; otherwise the selected space ids. */
export function holdSpaceIdsForSubmit(selection: HoldSpaceSelection): string[] {
  return selection.wholeVenue ? [] : selection.selectedSpaceIds;
}

/**
 * Clients Soft-URL — sync `?filter=` via History API without App Router remount.
 * Filtering itself stays in-memory on the SSR-loaded client array.
 */

import {
  isPortalActivationFilter,
  parseClientListFilter,
  type ClientListFilterKey,
} from "@/lib/clients/list-filters";

export const CLIENTS_SOFT_FILTER_STATE_KEY = "htcClientsSoftFilter";

export type ClientsSoftHistoryState = {
  [CLIENTS_SOFT_FILTER_STATE_KEY]?: ClientListFilterKey;
};

/** Precedence for the active Clients list filter. */
export function resolveClientListFilter(args: {
  softCommitted: ClientListFilterKey | null;
  urlFilter: ClientListFilterKey | null;
  stickyFilter: ClientListFilterKey;
}): ClientListFilterKey {
  return args.softCommitted ?? args.urlFilter ?? args.stickyFilter;
}

/** Build Clients list href preserving unrelated query params. */
export function clientsFilterHref(
  pathname: string,
  currentSearch: string,
  next: ClientListFilterKey,
): string {
  const params = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  params.set("filter", next);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function readFilterFromLocationSearch(search: string): ClientListFilterKey | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return parseClientListFilter(params.get("filter"));
}

export function shouldPersistStickyFilter(key: ClientListFilterKey): boolean {
  return !isPortalActivationFilter(key);
}

export function softClientsHistoryState(filter: ClientListFilterKey): ClientsSoftHistoryState {
  return { [CLIENTS_SOFT_FILTER_STATE_KEY]: filter };
}

export function filterFromPopState(
  eventState: unknown,
  locationSearch: string,
): ClientListFilterKey | null {
  const fromState =
    eventState &&
    typeof eventState === "object" &&
    CLIENTS_SOFT_FILTER_STATE_KEY in (eventState as object)
      ? parseClientListFilter(
          String((eventState as ClientsSoftHistoryState)[CLIENTS_SOFT_FILTER_STATE_KEY] ?? ""),
        )
      : null;
  return fromState ?? readFilterFromLocationSearch(locationSearch);
}

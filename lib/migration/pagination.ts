/**
 * Migration Center — full-result paging.
 *
 * PostgREST/Supabase responses are silently capped when callers use a single
 * `.limit(N)`. These helpers page with `.range` until a short page so session
 * processing and source-id discovery never drop trailing rows.
 */
export const MIGRATION_PAGE_SIZE = 1000;

/**
 * Fetch every page until exhausted. Deterministic: pages are requested in
 * ascending offset order; callers must supply a stable order in the query.
 * Throws if a page returns more rows than pageSize (contract violation).
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = MIGRATION_PAGE_SIZE,
): Promise<T[]> {
  if (pageSize < 1) throw new Error("pageSize must be >= 1");
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset, offset + pageSize - 1);
    if (page.length > pageSize) {
      throw new Error(`fetchAllPages: page returned ${page.length} rows (pageSize=${pageSize})`);
    }
    out.push(...page);
    if (page.length < pageSize) return out;
    offset += pageSize;
  }
}

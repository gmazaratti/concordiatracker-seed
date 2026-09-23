/**
 * The two codes that mean "that column is not there yet".
 *
 * PostgREST refuses an INSERT naming an unknown column from its own schema
 * cache with **PGRST204**, before Postgres is ever asked — so a write guard
 * that only looks for 42703 never fires, which is exactly how the personal
 * calendar's first migration guard failed to guard anything. **42703** is what
 * a SELECT of an unknown column returns, which is why the column probes are
 * right to check that one. Both are accepted because the cache can be stale in
 * either direction around a migration.
 *
 * SHARED, because there were two copies waiting to disagree: this is the test
 * every "degrade gracefully until the SQL is run" path in the app depends on.
 */
export function missingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === 'PGRST204' || error?.code === '42703'
}

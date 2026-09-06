// @ts-check
/**
 * Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
 * (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
 *
 * Applied files are keyed by BASENAME, so the same file applies once no matter
 * which directory it is globbed from. That is what makes the auth schema safe to
 * copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
 * a database that already has `0001_auth.sql` will not re-run it.
 *
 * Neither applier descends into subdirectories, so `migrations/auth/*.sql`
 * is out of scope for both until it is copied up.
 */

/**
 * The `_migrations` key for a migration path (or bare filename).
 * @param {string} path
 * @returns {string}
 */
export function migrationName(path) {
  return path.split("/").pop() ?? path;
}

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isMigrationFile(path) {
  return path.endsWith(".sql");
}

/**
 * Sort by the numeric migration prefix first, then by the full basename.
 * This keeps historical 3-digit migrations ahead of later 4-digit migrations
 * without renaming already-applied migration files.
 * @param {string} name
 * @returns {[number, string]}
 */
function migrationSortKey(name) {
  const match = name.match(/^(\d+)_/);
  return [match ? Number(match[1]) : Number.MAX_SAFE_INTEGER, name];
}

/**
 * Migrations in `paths` that are not yet in `applied`, in apply order.
 * Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
 * @param {Iterable<string>} paths
 * @param {Iterable<string>} applied
 * @returns {Array<{ name: string, path: string }>}
 */
export function pendingMigrations(paths, applied) {
  const done = new Set(applied);
  return [...paths]
    .filter(isMigrationFile)
    .map((path) => ({ name: migrationName(path), path }))
    .sort((a, b) => {
      const [aNumber, aName] = migrationSortKey(a.name);
      const [bNumber, bName] = migrationSortKey(b.name);
      return aNumber - bNumber || aName.localeCompare(bName);
    })
    .filter(({ name }) => !done.has(name));
}

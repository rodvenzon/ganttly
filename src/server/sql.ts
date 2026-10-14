/**
 * The small slice of the Cloudflare D1 API this app uses. Production passes
 * the real D1 binding; local development and tests pass `localDb` from
 * `sql-local.ts`, which implements the same shape over a SQLite file.
 *
 * `batch` must run its statements as one all-or-nothing transaction. Every
 * project save goes through a single batch, so a failure part-way through
 * (a stale revision, a duplicate id) leaves the database unchanged.
 */
export type SqlValue = string | number | null;
export interface SqlStatement {
  bind(...values: SqlValue[]): SqlStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface SqlDb {
  prepare(sql: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<unknown[]>;
}
/** Bind one JSON array as a single parameter; read rows with json_each. */
export const json = (rows: unknown[]) => JSON.stringify(rows);

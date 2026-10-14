import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SqlDb, SqlStatement, SqlValue } from "./sql";
class LocalStatement implements SqlStatement {
  constructor(
    private client: Client,
    readonly sql: string,
    readonly args: SqlValue[] = [],
  ) {}
  bind(...values: SqlValue[]) {
    return new LocalStatement(this.client, this.sql, values);
  }
  async all<T>() {
    const r = await this.client.execute({
      sql: this.sql,
      args: this.args as InValue[],
    });
    return { results: r.rows.map((row) => ({ ...row }) as T) };
  }
  async first<T>() {
    return (await this.all<T>()).results[0] ?? null;
  }
  run() {
    return this.client.execute({ sql: this.sql, args: this.args as InValue[] });
  }
}
/** A D1-shaped database over a local SQLite file, for development and tests. */
export function localDb(raw = process.env.DATABASE_URL ?? "file:./dev.db") {
  let url = raw;
  if (raw.startsWith("file:")) {
    const file = resolve("data", raw.slice(5));
    mkdirSync(dirname(file), { recursive: true }); // first run on a fresh clone
    url = pathToFileURL(file).href;
  }
  const client = createClient({ url });
  const db: SqlDb & { close(): void } = {
    prepare: (sql) => new LocalStatement(client, sql),
    async batch(statements) {
      const list = statements as LocalStatement[];
      // D1 always enforces foreign keys; match it so cascades behave the same.
      // The pragma is ignored inside a transaction, so set it just before.
      await client.execute("PRAGMA foreign_keys = ON");
      return client.batch(
        list.map((s) => ({ sql: s.sql, args: s.args as InValue[] })),
        "write",
      );
    },
    close: () => client.close(),
  };
  return db;
}

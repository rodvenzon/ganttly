import { applyCommand } from "@/lib/api/apply-command";
import type { Command } from "@/lib/api/commands";
import type { Person } from "@/lib/types";
import { readProjectWithRevision } from "./read";
import { persistStatements } from "./persist";
import { versionFor } from "./version";
import { ApiError } from "./http";
import type { SqlDb } from "./sql";
const STALE =
  "This project changed in another tab. The latest plan has been loaded; please retry your edit.";
/**
 * Applies one edit atomically. All writes go in a single D1 batch, which is
 * a transaction. Its first statement re-checks the revision we read: if
 * another save got in between, it raises an error (json() of a non-JSON
 * string) and the whole batch rolls back. The last statement bumps the
 * revision, so the next save from a stale tab is rejected the same way.
 */
type Countable = "tasks" | "groups" | "dependencies" | "comments";
export async function executeCommand(
  db: SqlDb,
  id: string,
  baseVersion: string,
  command: Command,
  user: Pick<Person, "name"> = { name: "Guest" },
  { limits }: { limits?: Partial<Record<Countable, number>> } = {},
) {
  const { project: before, revision } = await readProjectWithRevision(db, id);
  if ((await versionFor(id, revision)) !== baseVersion)
    throw new ApiError(STALE, 409);
  let after;
  try {
    after = applyCommand(before, command, {
      authorName: user.name,
      now: new Date().toISOString(),
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Invalid edit",
      400,
    );
  }
  for (const [key, max] of Object.entries(limits ?? {}) as [
    Countable,
    number,
  ][])
    if (after[key].length > max && after[key].length > before[key].length)
      throw new ApiError(
        `Demo projects are limited to ${max} ${key}. Start a new project to keep going.`,
        400,
      );
  const writes = persistStatements(db, before, after);
  if (writes.length) {
    try {
      await db.batch([
        db
          .prepare(
            "SELECT CASE WHEN revision = ? THEN 1 ELSE json('stale revision ' || id) END FROM Project WHERE id = ?",
          )
          .bind(revision, id),
        ...writes,
        db
          .prepare("UPDATE Project SET revision = revision + 1 WHERE id = ?")
          .bind(id),
      ]);
    } catch (error) {
      if (error instanceof Error && /malformed JSON/i.test(error.message))
        throw new ApiError(STALE, 409);
      throw error;
    }
  }
  const saved = await readProjectWithRevision(db, id);
  return {
    project: saved.project,
    version: await versionFor(id, saved.revision),
  };
}

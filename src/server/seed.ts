import type { ProjectDetail } from "@/lib/types";
import { json, type SqlDb, type SqlStatement } from "./sql";
import {
  insertGroups,
  insertTasks,
  insertAssignments,
  insertDependencies,
  insertComments,
} from "./persist";
/** Statements that insert a complete project (people are upserted). */
export function seedStatements(
  db: SqlDb,
  seed: ProjectDetail,
  ownerKey: string | null = null,
): SqlStatement[] {
  return [
    db
      .prepare(
        `INSERT INTO Assignee (id, name, avatarColor)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.name'), json_extract(value, '$.avatarColor')
         FROM json_each(?) WHERE true
         ON CONFLICT(id) DO NOTHING`,
      )
      .bind(json(seed.assignees)),
    db
      .prepare(
        "INSERT INTO Project (id, name, color, createdAt, archived, revision, ownerKey) VALUES (?, ?, ?, ?, ?, 0, ?)",
      )
      .bind(
        seed.id,
        seed.name,
        seed.color,
        seed.createdAt,
        seed.archived ? 1 : 0,
        ownerKey,
      ),
    insertGroups(db, seed.groups),
    insertTasks(db, seed.tasks),
    insertAssignments(db, seed.tasks),
    insertDependencies(db, seed.dependencies),
    insertComments(db, seed.comments),
  ];
}
export async function seedProject(db: SqlDb, seed: ProjectDetail) {
  const exists = await db
    .prepare("SELECT id FROM Project WHERE id = ?")
    .bind(seed.id)
    .first();
  if (exists) return false;
  await db.batch(seedStatements(db, seed));
  return true;
}

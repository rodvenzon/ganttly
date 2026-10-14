import { createProjectSchema } from "@/lib/api/commands";
import { readProjectWithRevision } from "./read";
import { versionFor } from "./version";
import type { SqlDb } from "./sql";
export async function createProject(
  db: SqlDb,
  input: unknown,
  ownerKey: string | null = null,
) {
  const data = createProjectSchema.parse(input);
  await db.batch([
    db
      .prepare(
        "INSERT INTO Project (id, name, color, createdAt, archived, revision, ownerKey) VALUES (?, ?, ?, ?, 0, 0, ?)",
      )
      .bind(data.id, data.name, data.color, new Date().toISOString(), ownerKey),
    db
      .prepare(
        "INSERT INTO TaskGroup (id, projectId, name, sortOrder) VALUES (?, ?, ?, 0)",
      )
      .bind(crypto.randomUUID(), data.id, "Project tasks"),
  ]);
  const { project, revision } = await readProjectWithRevision(db, data.id);
  return { project, version: await versionFor(data.id, revision) };
}

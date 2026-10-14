import type { SqlDb } from "./sql";
import { demoProject, DEFAULT_PEOPLE } from "./seed-data";
import { seedStatements } from "./seed";
/**
 * The whole database schema. Same entities as the original Prisma schema,
 * plus Project.revision, which every save increments; it is what makes
 * concurrent saves safe (see mutate.ts).
 *
 * To change the schema later, append a new numbered entry to MIGRATIONS.
 * Never edit an entry that has already run in production.
 */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE Project (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE TaskGroup (
      id TEXT NOT NULL PRIMARY KEY,
      projectId TEXT NOT NULL REFERENCES Project(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sortOrder INTEGER NOT NULL
    )`,
    `CREATE TABLE Task (
      id TEXT NOT NULL PRIMARY KEY,
      projectId TEXT NOT NULL REFERENCES Project(id) ON DELETE CASCADE,
      groupId TEXT REFERENCES TaskGroup(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      startDate TEXT,
      endDate TEXT,
      percentComplete INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      sortOrder INTEGER NOT NULL,
      isMilestone INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE Dependency (
      id TEXT NOT NULL PRIMARY KEY,
      predecessorTaskId TEXT NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
      successorTaskId TEXT NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'finish_to_start',
      UNIQUE (predecessorTaskId, successorTaskId)
    )`,
    `CREATE TABLE Assignee (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      avatarColor TEXT NOT NULL
    )`,
    `CREATE TABLE TaskAssignee (
      taskId TEXT NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
      assigneeId TEXT NOT NULL REFERENCES Assignee(id) ON DELETE CASCADE,
      PRIMARY KEY (taskId, assigneeId)
    )`,
    `CREATE TABLE Comment (
      id TEXT NOT NULL PRIMARY KEY,
      taskId TEXT NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
      authorName TEXT NOT NULL,
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`,
    `CREATE INDEX TaskGroup_project ON TaskGroup(projectId, sortOrder)`,
    `CREATE INDEX Task_project ON Task(projectId, groupId, sortOrder)`,
    `CREATE INDEX Dependency_successor ON Dependency(successorTaskId)`,
    `CREATE INDEX Comment_task ON Comment(taskId, createdAt)`,
  ],
  // 2: Assignee becomes the people directory: sign-in email, job title,
  // role (one super_admin) and active; the sample team is added.
  [
    `ALTER TABLE Assignee ADD COLUMN email TEXT`,
    `ALTER TABLE Assignee ADD COLUMN title TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE Assignee ADD COLUMN role TEXT NOT NULL DEFAULT 'member'`,
    `ALTER TABLE Assignee ADD COLUMN active INTEGER NOT NULL DEFAULT 1`,
    `CREATE UNIQUE INDEX Assignee_email ON Assignee(email) WHERE email IS NOT NULL`,
    ...DEFAULT_PEOPLE.map(
      (p) => `INSERT INTO Assignee (id, name, avatarColor, title, role)
        VALUES (${[p.id, p.name, p.avatarColor, p.title, p.role].map(sqlText).join(", ")})
        ON CONFLICT(id) DO UPDATE SET name = excluded.name,
          title = excluded.title, role = excluded.role`,
    ),
  ],
  // 3: Public demo. Each visitor's projects carry their ownerKey (null in
  // the signed-in edition); Meta holds small bookkeeping like lastCleanup.
  [
    `ALTER TABLE Project ADD COLUMN ownerKey TEXT`,
    `CREATE INDEX Project_owner ON Project(ownerKey, createdAt)`,
    `CREATE TABLE Meta (key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL)`,
  ],
];
/** Quote a constant for a migration statement (migrations take no binds). */
function sqlText(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
let ready: Promise<void> | null = null;
/**
 * Creates or upgrades the schema on first use, so a brand-new D1 database
 * needs no manual setup. A fresh database also gets the demo project.
 * Cached per isolate; costs one small query on cold start afterwards.
 */
export function ensureSchema(db: SqlDb, { seed = true } = {}) {
  return (ready ??= migrate(db, seed).catch((e) => {
    ready = null;
    throw e;
  }));
}
export function resetSchemaCache() {
  ready = null;
}
async function migrate(db: SqlDb, seed: boolean) {
  const table = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Migration'",
    )
    .first();
  const done = table
    ? ((
        await db.prepare("SELECT MAX(version) AS v FROM Migration").first<{
          v: number | null;
        }>()
      )?.v ?? 0)
    : 0;
  if (done >= MIGRATIONS.length) return;
  const statements = [
    db.prepare(
      "CREATE TABLE IF NOT EXISTS Migration (version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL)",
    ),
  ];
  for (let v = done; v < MIGRATIONS.length; v++) {
    statements.push(...MIGRATIONS[v].map((sql) => db.prepare(sql)));
    statements.push(
      db
        .prepare("INSERT INTO Migration (version, appliedAt) VALUES (?, ?)")
        .bind(v + 1, new Date().toISOString()),
    );
  }
  if (done === 0 && seed) statements.push(...seedStatements(db, demoProject()));
  // If two cold starts race, the loser's batch fails on CREATE TABLE and
  // rolls back; the winner's schema is then already in place.
  try {
    await db.batch(statements);
  } catch (e) {
    const now = await db
      .prepare("SELECT MAX(version) AS v FROM Migration")
      .first<{ v: number | null }>()
      .catch(() => null);
    if ((now?.v ?? 0) < MIGRATIONS.length) throw e;
  }
}

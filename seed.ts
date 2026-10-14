import { localDb } from "./src/server/sql-local";
import { ensureSchema } from "./src/server/schema";
import { seedProject } from "./src/server/seed";
import { demoProject } from "./src/server/seed-data";
// Creates the local database (data/dev.db) with the demo project.
// A brand-new database is seeded automatically on first request too.
const db = localDb();
try {
  await ensureSchema(db, { seed: false });
  const created = await seedProject(db, demoProject());
  console.log(
    created
      ? "Seeded 1 project, 4 groups, 40 tasks, 10 dependencies, 5 assignees."
      : "Demo project already exists; your edits are preserved.",
  );
} finally {
  db.close();
}

import { localDb } from "../src/server/sql-local";
import { ensureSchema } from "../src/server/schema";
import { demoProject } from "../src/server/seed-data";
import { seedProject } from "../src/server/seed";
const project = demoProject(500),
  prefix = "load-";
project.id = "load-test-500";
project.name = "500-task verification plan";
project.groups = project.groups.map((g) => ({
  ...g,
  id: prefix + g.id,
  projectId: project.id,
}));
project.tasks = project.tasks.map((t) => ({
  ...t,
  id: prefix + t.id,
  groupId: t.groupId ? prefix + t.groupId : null,
  projectId: project.id,
}));
project.dependencies = project.dependencies.map((d) => ({
  ...d,
  id: prefix + d.id,
  predecessorTaskId: prefix + d.predecessorTaskId,
  successorTaskId: prefix + d.successorTaskId,
}));
project.comments = [];
const db = localDb();
try {
  await ensureSchema(db);
  console.log(
    (await seedProject(db, project))
      ? "Created 500-task plan at /projects/load-test-500"
      : "500-task plan already exists.",
  );
} finally {
  db.close();
}

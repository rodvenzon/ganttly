import assert from "node:assert/strict";
import { localDb } from "../src/server/sql-local";
import type { ProjectEnvelope } from "../src/lib/api/client";
import type { Command } from "../src/lib/api/commands";
const base = process.env.API_URL ?? "http://127.0.0.1:3000",
  id = crypto.randomUUID();
async function call(
  path: string,
  method = "GET",
  payload?: unknown,
  expected = 200,
) {
  const result = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", origin: base },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  assert.equal(result.status, expected, await result.clone().text());
  return result.json();
}
let current: ProjectEnvelope;
async function edit(command: Command) {
  current = (await call("/api/projects/" + id + "/commands", "POST", {
    baseVersion: current.version,
    command,
  })) as ProjectEnvelope;
  return current;
}
try {
  current = (await call("/api/projects", "POST", {
    id,
    name: "API verification project",
    color: "gold",
  })) as ProjectEnvelope;
  const groupId = current.project.groups[0].id,
    first = crypto.randomUUID(),
    second = crypto.randomUUID();
  await edit({ type: "task.create", id: first, name: "Predecessor", groupId });
  await edit({
    type: "task.create",
    id: second,
    name: "Successor",
    groupId,
    isMilestone: true,
  });
  await edit({
    type: "task.update",
    id: first,
    patch: { startDate: "2026-11-01", endDate: "2026-11-03" },
  });
  await edit({
    type: "task.update",
    id: second,
    patch: { startDate: "2026-11-02", endDate: "2026-11-02" },
  });
  await edit({
    type: "dependency.add",
    id: crypto.randomUUID(),
    predecessorTaskId: first,
    successorTaskId: second,
  });
  assert.equal(
    current.project.tasks.find((t) => t.id === second)?.startDate,
    "2026-11-04",
  );
  const stale = current.version;
  await edit({
    type: "task.update",
    id: first,
    patch: {
      endDate: "2026-11-08",
      percentComplete: 65,
      assigneeIds: current.project.assignees.slice(0, 2).map((a) => a.id),
    },
  });
  assert.equal(
    current.project.tasks.find((t) => t.id === second)?.startDate,
    "2026-11-09",
  );
  await call(
    "/api/projects/" + id + "/commands",
    "POST",
    { baseVersion: stale, command: { type: "task.delete", id: first } },
    409,
  );
  await call(
    "/api/projects/" + id + "/commands",
    "POST",
    {
      baseVersion: current.version,
      command: {
        type: "dependency.add",
        id: crypto.randomUUID(),
        predecessorTaskId: second,
        successorTaskId: first,
      },
    },
    400,
  );
  await edit({
    type: "comment.add",
    id: crypto.randomUUID(),
    taskId: first,
    body: "Persisted through the HTTP API",
  });
  await edit({
    type: "project.update",
    name: "Renamed API project",
    archived: true,
  });
  await call(
    "/api/projects/" + id + "/commands",
    "POST",
    {
      baseVersion: current.version,
      command: { type: "task.delete", id: first },
    },
    400,
  );
  await edit({ type: "project.update", archived: false });
  const loaded = (await call("/api/projects/" + id)) as ProjectEnvelope;
  assert.deepEqual(loaded, current);
  assert.equal(loaded.project.comments[0].authorName, "Alex Morgan");
  await call("/api/projects/not-found", "GET", undefined, 404);
  console.log(
    "API smoke: create, schedule, cascade, progress, assignees, comments, rename, archive/restore, stale-write and cycle rejection passed.",
  );
} finally {
  // Clean up only against a local database; the API has no project delete.
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(base)) {
    const db = localDb();
    try {
      await db.batch([db.prepare("DELETE FROM Project WHERE id = ?").bind(id)]);
    } finally {
      db.close();
    }
  }
}

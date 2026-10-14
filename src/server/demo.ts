import type { ProjectDetail } from "@/lib/types";
import { ApiError } from "./http";
import { seedStatements } from "./seed";
import { demoProject } from "./seed-data";
import type { SqlDb } from "./sql";
/**
 * Public demo mode. No sign-in: each browser gets a random visitor key in
 * a cookie, and every project it creates carries that key as ownerKey, so
 * visitors never see each other's work. Projects expire after ttlDays.
 */
export const DEMO = {
  ttlDays: 3,
  maxProjects: 5,
  limits: { tasks: 200, groups: 30, dependencies: 300, comments: 300 },
  cookie: "ganttly_visitor",
} as const;
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const GUEST = {
  id: "guest",
  name: "Guest",
  title: "Demo visitor",
  avatarColor: "lagoon",
  email: null,
  role: "member",
  active: true,
} as const;
/** The visitor's key from the cookie, or a new one plus the cookie to set. */
export function visitorKey(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(
    new RegExp(`(?:^|;\\s*)${DEMO.cookie}=([^;]+)`),
  )?.[1];
  if (match && KEY.test(match)) return { key: match, setCookie: null };
  const key = crypto.randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    key,
    setCookie: `${DEMO.cookie}=${key}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`,
  };
}
/** 404 (not 403) for someone else's project, so ids reveal nothing. */
export async function assertOwner(db: SqlDb, id: string, owner: string) {
  const row = await db
    .prepare("SELECT 1 AS ok FROM Project WHERE id = ? AND ownerKey = ?")
    .bind(id, owner)
    .first();
  if (!row) throw new ApiError("Project not found", 404);
}
/** The sample project with ids unique to this visitor. */
export function demoCopy(owner: string): ProjectDetail {
  const base = demoProject();
  const tag = owner.slice(0, 8) + Date.now().toString(36);
  const re = (id: string) => `${tag}-${id}`;
  const projectId = `demo-${tag}`;
  return {
    ...base,
    id: projectId,
    groups: base.groups.map((g) => ({ ...g, id: re(g.id), projectId })),
    tasks: base.tasks.map((t) => ({
      ...t,
      id: re(t.id),
      projectId,
      groupId: t.groupId ? re(t.groupId) : null,
    })),
    dependencies: base.dependencies.map((d) => ({
      ...d,
      id: re(d.id),
      predecessorTaskId: re(d.predecessorTaskId),
      successorTaskId: re(d.successorTaskId),
    })),
    comments: base.comments.map((c) => ({
      ...c,
      id: re(c.id),
      taskId: re(c.taskId),
    })),
  };
}
async function countProjects(db: SqlDb, owner: string) {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM Project WHERE ownerKey = ?")
    .bind(owner)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
/**
 * A first-time visitor starts with their own copy of the sample project.
 * The marker insert goes first and has no ON CONFLICT, so if two first
 * requests race, the loser's whole batch rolls back instead of seeding twice.
 */
export async function ensureVisitorDemo(db: SqlDb, owner: string) {
  const seen = await db
    .prepare("SELECT value FROM Meta WHERE key = ?")
    .bind(`seeded:${owner}`)
    .first();
  if (seen) return;
  try {
    await db.batch([
      db
        .prepare("INSERT INTO Meta (key, value) VALUES (?, ?)")
        .bind(`seeded:${owner}`, new Date().toISOString()),
      ...seedStatements(db, demoCopy(owner), owner),
    ]);
  } catch (e) {
    if (!(e instanceof Error && /UNIQUE|constraint/i.test(e.message))) throw e;
  }
}
export async function assertCanCreate(db: SqlDb, owner: string) {
  if ((await countProjects(db, owner)) >= DEMO.maxProjects)
    throw new ApiError(
      `The demo keeps up to ${DEMO.maxProjects} projects per visitor. Reset the demo to start fresh.`,
      400,
    );
}
/** Delete everything this visitor made and give them a fresh sample. */
export async function resetVisitor(db: SqlDb, owner: string) {
  await db.batch([
    db.prepare("DELETE FROM Project WHERE ownerKey = ?").bind(owner),
    ...seedStatements(db, demoCopy(owner), owner),
    db
      .prepare(
        "INSERT INTO Meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .bind(`seeded:${owner}`, new Date().toISOString()),
  ]);
}
/**
 * Removes expired visitors' projects (and their seeded markers). Runs at
 * most once an hour, piggybacking on ordinary requests.
 */
export async function cleanupExpired(db: SqlDb, now = Date.now()) {
  const last = await db
    .prepare("SELECT value FROM Meta WHERE key = 'lastCleanup'")
    .first<{ value: string }>();
  if (last && now - Date.parse(last.value) < 60 * 60 * 1000) return false;
  const cutoff = new Date(now - DEMO.ttlDays * 86400000).toISOString();
  await db.batch([
    db
      .prepare(
        "INSERT INTO Meta (key, value) VALUES ('lastCleanup', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .bind(new Date(now).toISOString()),
    db
      .prepare(
        "DELETE FROM Project WHERE ownerKey IS NOT NULL AND createdAt < ?",
      )
      .bind(cutoff),
    db
      .prepare("DELETE FROM Meta WHERE key LIKE 'seeded:%' AND value < ?")
      .bind(cutoff),
  ]);
  return true;
}

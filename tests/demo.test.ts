import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localDb } from "@/server/sql-local";
import { resetSchemaCache } from "@/server/schema";
import { handleApi } from "@/server/api";
import { DEMO, cleanupExpired } from "@/server/demo";
const dir = mkdtempSync(join(tmpdir(), "ganttly-demo-")),
  db = localDb("file:" + join(dir, "demo.db"));
beforeAll(() => resetSchemaCache());
afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  resetSchemaCache();
});
const base = "https://ganttly.example";
const call = (cookie: string | null, path: string, init: RequestInit = {}) =>
  handleApi(
    new Request(base + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        origin: base,
        ...(cookie ? { cookie } : {}),
      },
    }),
    db,
    { demo: true },
  );
const json = async <T>(res: Response) => (await res.json()) as T;
type Summary = { id: string; name: string; taskCount: number };
type Envelope = {
  project: { id: string; tasks: { id: string; name: string }[] };
  version: string;
};
async function newVisitor() {
  const res = await call(null, "/api/me");
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  return { cookie, me: await json<{ user: { name: string } }>(res) };
}
describe("public demo", () => {
  let a: string, b: string;
  it("gives each new browser a visitor cookie and a guest identity", async () => {
    const first = await newVisitor();
    expect(first.cookie).toMatch(/^ganttly_visitor=[0-9a-f-]{36}$/);
    expect(first.me).toMatchObject({
      user: { name: "Guest" },
      demo: { ttlDays: DEMO.ttlDays },
    });
    a = first.cookie;
    b = (await newVisitor()).cookie;
    expect(b).not.toBe(a);
    // A returning browser keeps its key: no new cookie.
    expect((await call(a, "/api/me")).headers.get("set-cookie")).toBeNull();
  });
  it("seeds a private copy of the sample for each visitor, once", async () => {
    const [listA, listB] = await Promise.all([
      call(a, "/api/projects").then(json<Summary[]>),
      call(b, "/api/projects").then(json<Summary[]>),
    ]);
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(1);
    expect(listA[0]).toMatchObject({ name: "Website relaunch", taskCount: 40 });
    expect(listA[0].id).not.toBe(listB[0].id);
    // Racing first loads don't seed twice.
    const c = (await newVisitor()).cookie;
    await Promise.all([
      call(c, "/api/projects"),
      call(c, "/api/projects"),
      call(c, "/api/projects"),
    ]);
    expect(await call(c, "/api/projects").then(json<Summary[]>)).toHaveLength(
      1,
    );
    expect(await call(a, "/api/projects").then(json<Summary[]>)).toHaveLength(
      1,
    );
  });
  it("keeps visitors out of each other's projects", async () => {
    const [mine] = await call(a, "/api/projects").then(json<Summary[]>);
    expect((await call(b, `/api/projects/${mine.id}`)).status).toBe(404);
    const { version } = await call(a, `/api/projects/${mine.id}`).then(
      json<Envelope>,
    );
    const sneak = await call(b, `/api/projects/${mine.id}/commands`, {
      method: "POST",
      body: JSON.stringify({
        baseVersion: version,
        command: { type: "project.update", name: "Hacked", color: "coral" },
      }),
    });
    expect(sneak.status).toBe(404);
    expect((await call(null, `/api/projects/${mine.id}`)).status).toBe(404);
  });
  it("lets a visitor edit their own copy as Guest", async () => {
    const [mine] = await call(a, "/api/projects").then(json<Summary[]>);
    const { project, version } = await call(a, `/api/projects/${mine.id}`).then(
      json<Envelope>,
    );
    const res = await call(a, `/api/projects/${mine.id}/commands`, {
      method: "POST",
      body: JSON.stringify({
        baseVersion: version,
        command: {
          type: "comment.add",
          id: crypto.randomUUID(),
          taskId: project.tasks[0].id,
          body: "Looks good",
        },
      }),
    });
    expect(res.status).toBe(200);
    const { project: after } = await json<{
      project: { comments: { authorName: string; body: string }[] };
    }>(res);
    expect(after.comments.at(-1)).toMatchObject({
      authorName: "Guest",
      body: "Looks good",
    });
  });
  it("hides the people directory and admin routes", async () => {
    for (const path of ["/api/people", "/api/admin/claim"])
      expect((await call(a, path, { method: "POST", body: "{}" })).status).toBe(
        404,
      );
    expect((await call(a, "/api/people")).status).toBe(404);
  });
  it("caps projects per visitor and tasks per project", async () => {
    const create = (n: number) =>
      call(a, "/api/projects", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          name: `Plan ${n}`,
          color: "mist",
        }),
      });
    for (let n = 2; n <= DEMO.maxProjects; n++)
      expect((await create(n)).status).toBe(200);
    const over = await create(99);
    expect(over.status).toBe(400);
    expect((await json<{ error: string }>(over)).error).toMatch(/up to 5/);
    const list = await call(a, "/api/projects").then(json<Summary[]>);
    const empty = list.find((p) => p.taskCount === 0)!;
    let { version } = await call(a, `/api/projects/${empty.id}`).then(
      json<Envelope>,
    );
    let last: Response | null = null;
    for (let i = 0; i <= DEMO.limits.tasks; i++) {
      last = await call(a, `/api/projects/${empty.id}/commands`, {
        method: "POST",
        body: JSON.stringify({
          baseVersion: version,
          command: {
            type: "task.create",
            id: crypto.randomUUID(),
            name: `Task ${i}`,
            groupId: null,
          },
        }),
      });
      if (last.status !== 200) break;
      version = (await json<Envelope>(last)).version;
    }
    expect(last!.status).toBe(400);
    expect((await json<{ error: string }>(last!)).error).toMatch(
      /limited to 200 tasks/,
    );
  }, 60000);
  it("resets a visitor back to one fresh sample without touching others", async () => {
    const before = await call(b, "/api/projects").then(json<Summary[]>);
    const res = await call(a, "/api/demo/reset", {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const list = await call(a, "/api/projects").then(json<Summary[]>);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Website relaunch", taskCount: 40 });
    expect(await call(b, "/api/projects").then(json<Summary[]>)).toEqual(
      before,
    );
    // Cross-site resets are refused.
    const evil = await handleApi(
      new Request(base + "/api/demo/reset", {
        method: "POST",
        body: "{}",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
          cookie: a,
        },
      }),
      db,
      { demo: true },
    );
    expect(evil.status).toBe(403);
  });
  it("clears out projects older than the time limit, at most hourly", async () => {
    const later = Date.now() + (DEMO.ttlDays + 1) * 86400000;
    expect(await cleanupExpired(db, later)).toBe(true);
    expect(await cleanupExpired(db, later + 60000)).toBe(false);
    const { n } = (await db
      .prepare("SELECT COUNT(*) AS n FROM Project")
      .first<{ n: number }>())!;
    expect(n).toBe(0);
    // Returning after expiry: a fresh sample again.
    const list = await call(a, "/api/projects").then(json<Summary[]>);
    expect(list).toHaveLength(1);
  });
});

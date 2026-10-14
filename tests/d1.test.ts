import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localDb } from "@/server/sql-local";
import { ensureSchema, resetSchemaCache } from "@/server/schema";
import { handleApi } from "@/server/api";
const dir = mkdtempSync(join(tmpdir(), "ganttly-d1-")),
  db = localDb("file:" + join(dir, "fresh.db"));
afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const base = "https://ganttly.example";
const call = (path: string, init: RequestInit = {}) =>
  handleApi(
    new Request(base + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        origin: base,
        ...(init.headers ?? {}),
      },
    }),
    db,
  );
describe("Cloudflare D1 layer", () => {
  it("sets up a brand-new database with the demo project on first request", async () => {
    resetSchemaCache();
    const res = await call("/api/projects");
    expect(res.status).toBe(200);
    const list = (await res.json()) as { id: string; taskCount: number }[];
    expect(list).toMatchObject([{ id: "demo-project", taskCount: 40 }]);
    resetSchemaCache();
    await ensureSchema(db); // second run is a no-op, not a second seed
    expect(((await (await call("/api/projects")).json()) as []).length).toBe(1);
  });
  it("accepts only one of two simultaneous saves from the same version", async () => {
    const { version } = (await (
      await call("/api/projects/demo-project")
    ).json()) as { version: string };
    const save = (name: string) =>
      call("/api/projects/demo-project/commands", {
        method: "POST",
        body: JSON.stringify({
          baseVersion: version,
          command: { type: "task.update", id: "task-1", patch: { name } },
        }),
      });
    const results = await Promise.all([save("First"), save("Second")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)!;
    const saved = (await winner.json()) as {
      project: { tasks: { id: string; name: string }[] };
    };
    const now = (await (await call("/api/projects/demo-project")).json()) as {
      project: { tasks: { id: string; name: string }[] };
    };
    expect(now.project.tasks.find((t) => t.id === "task-1")!.name).toBe(
      saved.project.tasks.find((t) => t.id === "task-1")!.name,
    );
  });
  it("creates a project and rejects unknown routes and methods", async () => {
    const created = await call("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        id: "new-one",
        name: "Fresh plan",
        color: "sand",
      }),
    });
    expect(created.status).toBe(200);
    const { project } = (await created.json()) as {
      project: { groups: unknown[]; tasks: unknown[] };
    };
    expect(project.groups).toHaveLength(1);
    expect((await call("/api/nothing")).status).toBe(404);
    expect((await call("/api/projects/new-one/other")).status).toBe(404);
    expect(
      (await call("/api/projects/new-one", { method: "DELETE" })).status,
    ).toBe(405);
    expect((await call("/api/projects/missing")).status).toBe(404);
  });
});
// Requests as they arrive behind Cloudflare Access, signed in as `email`.
const as = (email: string, path: string, init: RequestInit = {}) =>
  handleApi(
    new Request(base + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        origin: base,
        "cf-access-authenticated-user-email": email,
      },
    }),
    db,
    { requireAccess: true },
  );
const json = async <T>(res: Response) => (await res.json()) as T;
describe("super admin and enrollment", () => {
  const ADMIN = "alex.morgan@example.com",
    NEW = "new.joiner@example.com";
  it("starts with the five sample people and Alex as super admin", async () => {
    const people = await json<
      { id: string; name: string; title: string; role: string }[]
    >(await call("/api/people"));
    expect(people.map((p) => `${p.name} (${p.title})`)).toEqual([
      "Alex Morgan (Project Lead)",
      "Maya Torres (Head of Marketing)",
      "Jamie Chen (Designer)",
      "Sam Rivera (Developer)",
      "Priya Nair (Content Lead)",
    ]);
    expect(people.filter((p) => p.role === "super_admin")).toHaveLength(1);
  });
  it("blocks everyone behind Access until enrolled, and refuses no sign-in", async () => {
    const res = await as(ADMIN, "/api/projects");
    expect(res.status).toBe(403);
    expect(await json<{ code: string }>(res)).toMatchObject({
      code: "NOT_ENROLLED",
    });
    const anon = await handleApi(new Request(base + "/api/projects"), db, {
      requireAccess: true,
    });
    expect(anon.status).toBe(401);
  });
  it("lets the first claim bind the super admin, once", async () => {
    const claim = await as(ADMIN, "/api/admin/claim", { method: "POST" });
    expect(claim.status).toBe(200);
    expect(
      await json<{ user: { name: string; role: string } }>(claim),
    ).toMatchObject({ user: { name: "Alex Morgan", role: "super_admin" } });
    expect((await as(NEW, "/api/admin/claim", { method: "POST" })).status).toBe(
      409,
    );
    const me = await json<{ user: { email: string } }>(
      await as(ADMIN, "/api/me"),
    );
    expect(me.user.email).toBe(ADMIN);
  });
  it("lets the super admin enroll someone, who can then sign in and comment", async () => {
    expect((await as(NEW, "/api/me")).status).toBe(403);
    const enrolled = await as(ADMIN, "/api/people", {
      method: "POST",
      body: JSON.stringify({
        name: "New Joiner",
        title: "Designer",
        email: "New.Joiner@example.com",
      }),
    });
    expect(enrolled.status).toBe(200);
    const me = await json<{ user: { name: string; role: string } }>(
      await as(NEW, "/api/me"),
    );
    expect(me.user).toMatchObject({ name: "New Joiner", role: "member" });
    const { version } = await json<{ version: string }>(
      await as(NEW, "/api/projects/demo-project"),
    );
    const res = await as(NEW, "/api/projects/demo-project/commands", {
      method: "POST",
      body: JSON.stringify({
        baseVersion: version,
        command: {
          type: "comment.add",
          id: "joiner-comment",
          taskId: "task-2",
          body: "Hello",
        },
      }),
    });
    const { project } = await json<{
      project: {
        comments: { id: string; authorName: string }[];
        assignees: { name: string }[];
      };
    }>(res);
    expect(
      project.comments.find((c) => c.id === "joiner-comment")!.authorName,
    ).toBe("New Joiner");
    expect(project.assignees.map((a) => a.name)).toContain("New Joiner");
  });
  it("keeps people management to the super admin", async () => {
    expect((await as(NEW, "/api/people")).status).toBe(403);
    const sneak = await as(NEW, "/api/people", {
      method: "POST",
      body: JSON.stringify({ name: "X", title: "", email: "x@example.com" }),
    });
    expect(sneak.status).toBe(403);
  });
  it("validates emails and rejects duplicates", async () => {
    const outside = await as(ADMIN, "/api/people", {
      method: "POST",
      body: JSON.stringify({ name: "Ext", title: "", email: "not-an-email" }),
    });
    expect(outside.status).toBe(400);
    expect((await json<{ error: string }>(outside)).error).toMatch(
      /valid email/,
    );
    const dup = await as(ADMIN, "/api/people", {
      method: "POST",
      body: JSON.stringify({ name: "Dup", title: "", email: NEW }),
    });
    expect(dup.status).toBe(409);
  });
  it("removes and restores access without losing their task history", async () => {
    const people = await json<{ id: string; email: string | null }[]>(
      await as(ADMIN, "/api/people"),
    );
    const joiner = people.find((p) => p.email === NEW)!;
    const off = await as(ADMIN, `/api/people/${joiner.id}`, {
      method: "POST",
      body: JSON.stringify({ active: false }),
    });
    expect(off.status).toBe(200);
    expect((await as(NEW, "/api/projects")).status).toBe(403);
    const { project } = await json<{
      project: {
        comments: { id: string }[];
        assignees: { id: string; active: boolean }[];
      };
    }>(await as(ADMIN, "/api/projects/demo-project"));
    expect(project.comments.some((c) => c.id === "joiner-comment")).toBe(true);
    expect(project.assignees.find((a) => a.id === joiner.id)!.active).toBe(
      false,
    );
    await as(ADMIN, `/api/people/${joiner.id}`, {
      method: "POST",
      body: JSON.stringify({ active: true }),
    });
    expect((await as(NEW, "/api/projects")).status).toBe(200);
  });
  it("won't let the super admin lock themselves out", async () => {
    const me = await json<{ user: { id: string } }>(await as(ADMIN, "/api/me"));
    for (const patch of [{ active: false }, { email: "other@example.com" }]) {
      const res = await as(ADMIN, `/api/people/${me.user.id}`, {
        method: "POST",
        body: JSON.stringify(patch),
      });
      expect(res.status).toBe(400);
    }
  });
});
